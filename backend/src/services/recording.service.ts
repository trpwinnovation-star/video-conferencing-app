import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { uploadFileToS3, generateSignedUrl } from './s3.service';
import { sendRecordingReadyEmail } from './email.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CHUNKS_DIR = path.join(os.tmpdir(), 'video-app-chunks');
const MERGED_DIR = path.join(os.tmpdir(), 'video-app-merged');

// Ensure directories exist
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
if (!fs.existsSync(MERGED_DIR)) fs.mkdirSync(MERGED_DIR, { recursive: true });

/**
 * Merge chunks sequentially into a single file with production-level stream stability
 */
const mergeChunks = async (meetingId: string, totalChunks: number): Promise<string> => {
  const mergedFilePath = path.join(MERGED_DIR, `${meetingId}.webm`);
  const writeStream = fs.createWriteStream(mergedFilePath);

  console.log(`[RECORDING] Starting stream-pipeline merge for ${meetingId}. Total expected: ${totalChunks}`);

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(CHUNKS_DIR, meetingId, `${i}.webm`);
      if (fs.existsSync(chunkPath)) {
        console.log(`[RECORDING] Merging chunk ${i}...`);
        const readStream = fs.createReadStream(chunkPath);
        // Use manual chunking to avoid closing the writeStream prematurely
        for await (const chunk of readStream) {
          if (!writeStream.write(chunk)) {
            await new Promise<void>(resolve => writeStream.once('drain', resolve));
          }
        }
      } else {
        console.warn(`[RECORDING] Skipping missing chunk ${i} for meeting ${meetingId}`);
      }
    }
  } finally {
    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  return mergedFilePath;
};

/**
 * Process the recording after the meeting ends
 */
export const processRecording = async (
  recordingId: string,
  roomId: string,
  meetingId: string,
  totalChunks: number,
  email: string
) => {
  try {
    // 1. Update status to processing
    await (prisma as any).recording.update({
      where: { id: recordingId },
      data: { status: 'processing' },
    });

    console.log(`[RECORDING] Processing session ${recordingId} (${totalChunks} chunks)`);

    // 2. Merge chunks
    const mergedFilePath = await mergeChunks(meetingId, totalChunks);
    
    if (!fs.existsSync(mergedFilePath)) {
      throw new Error(`Critical Error: Merged file was not created.`);
    }

    const stats = fs.statSync(mergedFilePath);
    if (stats.size === 0) {
      throw new Error('Critical Error: Merged file is empty (0 bytes).');
    }
    
    console.log(`[RECORDING] Final video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // 3. Upload to S3
    const s3Key = `meeting-recordings/${roomId}/${meetingId}.webm`;
    await uploadFileToS3(mergedFilePath, s3Key);
    console.log(`[RECORDING] S3 Upload Success`);

    // 4. Generate a signed URL for email
    const signedUrl = await generateSignedUrl(s3Key);

    // 5. Update DB
    await (prisma as any).recording.update({
      where: { id: recordingId },
      data: {
        status: 'completed',
        fileSize: stats.size,
        s3Key: s3Key,
      },
    });

    // 6. Send Email
    if (email) {
      const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const recordingLink = `${frontendUrl}/recordings/${recordingId}`;
      try {
        await sendRecordingReadyEmail(email, roomId, recordingLink);
        console.log(`[RECORDING] Notification sent to ${email}`);
      } catch (e) {
        console.warn(`[RECORDING] Email failed (non-blocking)`);
      }
    }

    // 7. Final Cleanup
    console.log(`[RECORDING] Cleaning up temporary files...`);
    fs.rmSync(path.join(CHUNKS_DIR, meetingId), { recursive: true, force: true });
    fs.rmSync(mergedFilePath, { force: true });

  } catch (error: any) {
    console.error(`[RECORDING] FATAL ERROR:`, error.message);
    try {
      await (prisma as any).recording.update({
        where: { id: recordingId },
        data: { 
          status: 'failed',
          failureReason: error.message || String(error)
        },
      });
    } catch (dbError) {
      console.error(`[RECORDING] Could not record failure in DB`);
    }
  }
};
