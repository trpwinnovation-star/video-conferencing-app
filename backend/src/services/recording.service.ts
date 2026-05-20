import fs from 'fs';
import path from 'path';
import { uploadFileToS3, generateSignedUrl } from './s3.service';
import { sendRecordingReadyEmail } from './email.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CHUNKS_DIR = path.join(__dirname, '../../uploads/chunks');
const MERGED_DIR = path.join(__dirname, '../../uploads/merged');

// Ensure directories exist
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
if (!fs.existsSync(MERGED_DIR)) fs.mkdirSync(MERGED_DIR, { recursive: true });

/**
 * Merge chunks sequentially into a single file
 */
const mergeChunks = async (meetingId: string, totalChunks: number): Promise<string> => {
  const mergedFilePath = path.join(MERGED_DIR, `${meetingId}.webm`);
  const writeStream = fs.createWriteStream(mergedFilePath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(CHUNKS_DIR, meetingId, `${i}.webm`);
    if (fs.existsSync(chunkPath)) {
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
    } else {
      console.warn(`Chunk ${i} missing for meeting ${meetingId}`);
    }
  }

  writeStream.end();
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve(mergedFilePath));
    writeStream.on('error', reject);
  });
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
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'processing' },
    });

    console.log(`[RECORDING] Starting processing for recordingId: ${recordingId}, meetingId: ${meetingId}`);

    // 2. Merge chunks
    console.log(`[RECORDING] Merging ${totalChunks} chunks for meeting ${meetingId}...`);
    const mergedFilePath = await mergeChunks(meetingId, totalChunks);
    
    if (!fs.existsSync(mergedFilePath)) {
      throw new Error(`Critical Error: Merged file was not created at ${mergedFilePath}`);
    }

    const stats = fs.statSync(mergedFilePath);
    if (stats.size === 0) {
      throw new Error('Critical Error: Merged file is empty (0 bytes). Check if chunks were uploaded correctly.');
    }
    
    console.log(`[RECORDING] Merged file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // 3. Upload to S3
    const s3Key = `meeting-recordings/${roomId}/${meetingId}.webm`;
    console.log(`[RECORDING] S3 Upload Attempt - Key: ${s3Key}, Bucket: ${process.env.AWS_S3_BUCKET_NAME || 'meeting-recordings'}`);
    
    try {
      await uploadFileToS3(mergedFilePath, s3Key);
      console.log(`[RECORDING] S3 Upload SUCCESS`);
    } catch (s3Error: any) {
      console.error(`[RECORDING] S3 Upload FAILURE:`, s3Error.message);
      if (process.env.MINIO_ENDPOINT?.includes('192.168.')) {
        console.error(`[RECORDING] TIP: You are using a local IP (${process.env.MINIO_ENDPOINT}) from a cloud environment (Render). This WILL NOT work.`);
      }
      throw s3Error;
    }

    // 4. Generate a signed URL for email (valid for 24h)
    console.log(`[RECORDING] Generating signed URL...`);
    const signedUrl = await generateSignedUrl(s3Key);

    // 5. Update DB
    console.log(`[RECORDING] Updating database status to 'completed'...`);
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: 'completed',
        fileSize: stats.size,
        s3Key: s3Key,
      },
    });
    console.log(`[RECORDING] Database updated successfully.`);

    // 6. Send Email
    if (email) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const recordingLink = `${frontendUrl}/recordings/${recordingId}`;
      console.log(`[RECORDING] Sending notification email to: ${email}`);
      try {
        await sendRecordingReadyEmail(email, roomId, recordingLink);
        console.log(`[RECORDING] Email sent.`);
      } catch (emailError) {
        console.error(`[RECORDING] Email failed (non-blocking):`, emailError);
      }
    }

    // 7. Cleanup chunks and local merged file
    console.log(`[RECORDING] Cleaning up temporary files...`);
    try {
      fs.rmSync(path.join(CHUNKS_DIR, meetingId), { recursive: true, force: true });
      fs.rmSync(mergedFilePath, { force: true });
      console.log(`[RECORDING] Cleanup complete.`);
    } catch (cleanupError) {
      console.warn(`[RECORDING] Cleanup warning:`, cleanupError);
    }

    console.log(`[RECORDING] ✅ Final Process Finish for ${meetingId}`);
  } catch (error: any) {
    console.error(`[RECORDING] ❌ FATAL ERROR processing ${meetingId}:`, error.message);
    try {
      await prisma.recording.update({
        where: { id: recordingId },
        data: { 
          status: 'failed',
          failureReason: error.message || String(error)
        },
      });
      console.log(`[RECORDING] Status updated to 'failed' in database.`);
    } catch (dbError) {
      console.error(`[RECORDING] Could not update status to 'failed':`, dbError);
    }
  }
};
