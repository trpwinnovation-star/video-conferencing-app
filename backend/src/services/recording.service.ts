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

    // 2. Merge chunks
    console.log(`Merging ${totalChunks} chunks for meeting ${meetingId}...`);
    const mergedFilePath = await mergeChunks(meetingId, totalChunks);
    const stats = fs.statSync(mergedFilePath);

    // 3. Upload to S3
    const s3Key = `meeting-recordings/${roomId}/${meetingId}.webm`;
    console.log(`Uploading merged file to S3: ${s3Key}`);
    await uploadFileToS3(mergedFilePath, s3Key);

    // 4. Generate a signed URL for email (valid for 24h)
    const signedUrl = await generateSignedUrl(s3Key);

    // 5. Update DB
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: 'completed',
        fileSize: stats.size,
        s3Key: s3Key,
        // We don't necessarily store the 24h signed URL in the DB permanently, 
        // because it expires. The access page will generate a new one on demand.
        // But we can store it or leave it empty.
      },
    });

    // 6. Send Email
    if (email) {
      console.log(`Sending email to ${email}...`);
      // Use the frontend URL to view the recording, not the raw S3 URL directly
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const recordingLink = `${frontendUrl}/recordings/${recordingId}`;
      await sendRecordingReadyEmail(email, roomId, recordingLink);
    }

    // 7. Cleanup chunks and local merged file to save space
    fs.rmSync(path.join(CHUNKS_DIR, meetingId), { recursive: true, force: true });
    fs.rmSync(mergedFilePath, { force: true });

    console.log(`Successfully processed recording for ${meetingId}`);
  } catch (error) {
    console.error(`Failed to process recording ${meetingId}:`, error);
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'failed' },
    });
  }
};
