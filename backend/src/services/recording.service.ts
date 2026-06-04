import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { uploadFileToS3, generateSignedUrl } from './s3.service';
import { sendRecordingReadyEmail } from './email.service';
import { prisma } from '../lib/db';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const CHUNKS_DIR = path.join(os.tmpdir(), 'video-app-chunks');
const MERGED_DIR = path.join(os.tmpdir(), 'video-app-merged');

// Ensure directories exist
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
if (!fs.existsSync(MERGED_DIR)) fs.mkdirSync(MERGED_DIR, { recursive: true });

/**
 * Merge chunks sequentially into a single file with production-level stream stability
 */
const mergeChunks = async (meetingId: string, totalChunks: number): Promise<string> => {
  const mergedFilePath = path.join(MERGED_DIR, `${meetingId}.mkv`);
  const writeStream = fs.createWriteStream(mergedFilePath);

  console.log(`[RECORDING] Starting stream-pipeline merge for ${meetingId}. Total expected: ${totalChunks}`);

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(CHUNKS_DIR, meetingId, `${i}.mkv`);
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
 * Transcodes the merged WebM/MKV file into a standard MP4 for maximum compatibility
 */
const convertToMp4 = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`[RECORDING] Starting ffmpeg conversion to MP4...`);
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',      // Standard MP4 video codec
        '-preset fast',      // Faster encoding speed
        '-crf 28',           // Good balance of quality/file size
        '-pix_fmt yuv420p',  // CRITICAL: Required for MP4 playback on Mac/QuickTime/Windows
        '-c:a aac',          // Standard MP4 audio codec
        '-b:a 128k',         // Standard audio bitrate
        '-movflags +faststart' // Optimizes file for web streaming
      ])
      .save(outputPath)
      .on('end', () => {
        console.log(`[RECORDING] ffmpeg conversion finished successfully.`);
        resolve();
      })
      .on('error', (err) => {
        console.error('[RECORDING] ffmpeg error:', err);
        reject(err);
      });
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

    console.log(`[RECORDING] Processing session ${recordingId} (${totalChunks} chunks)`);

    // 2. Merge all chunks into a single raw file
    const mergedFilePath = await mergeChunks(meetingId, totalChunks);

    // 2.5 Convert the raw file into a highly compatible MP4
    const mp4FilePath = path.join(MERGED_DIR, `${meetingId}.mp4`);
    await convertToMp4(mergedFilePath, mp4FilePath);

    if (!fs.existsSync(mp4FilePath)) {
      throw new Error(`Critical Error: MP4 file was not created.`);
    }

    const stats = fs.statSync(mp4FilePath);
    console.log(`[RECORDING] Final MP4 video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // 3. Upload to S3
    const s3Key = `meeting-recordings/${roomId}/${meetingId}.mp4`;
    await uploadFileToS3(mp4FilePath, s3Key);

    console.log(`[RECORDING] S3 Upload Success`);

    // 4. Generate a signed URL for email
    const signedUrl = await generateSignedUrl(s3Key);

    console.log("signed url generated", signedUrl)

    // 5. Update DB
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: 'completed',
        fileSize: stats.size,
        s3Key: s3Key,
        downloadExpiresAt: fiveDaysFromNow,
      },
    });

    // 6. Send Email
    if (email) {
      const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const recordingLink = `${frontendUrl}/recordings/${recordingId}`;
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        try {
          await sendRecordingReadyEmail(adminEmail, roomId, signedUrl);
          console.log(`[RECORDING] Notification sent to ${email}`);
        } catch (e) {
          console.warn(`[RECORDING] Email failed (non-blocking)`);
        }
      }
    }

    // 7. Final Cleanup
    console.log(`[RECORDING] Cleaning up temporary files...`);
    fs.rmSync(path.join(CHUNKS_DIR, meetingId), { recursive: true, force: true });
    fs.rmSync(mergedFilePath, { force: true });

  } catch (error: any) {
    console.error(`[RECORDING] FATAL ERROR:`, error.message);
    try {
      await prisma.recording.update({
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

/**
 * Background Cron Job: Auto-completes abandoned recordings
 * If a user closes the tab or drops connection, the frontend never calls /finish.
 * This checks for recordings that haven't received a chunk (heartbeat) in 2 minutes.
 */
export const startRecordingAutoCompleter = () => {
  console.log('[RECORDING] Auto-completer cron job started (checking every 60s)');

  setInterval(async () => {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      const abandonedRecordings = await prisma.recording.findMany({
        where: {
          status: 'recording',
          updatedAt: { lt: twoMinutesAgo },
        },
      });

      for (const rec of abandonedRecordings) {
        console.log(`[RECORDING] Detected abandoned recording: ${rec.meetingId}`);
        const meetingChunksDir = path.join(CHUNKS_DIR, rec.meetingId);

        if (fs.existsSync(meetingChunksDir)) {
          // Count the chunks (e.g. "0.webm", "1.webm")
          const files = fs.readdirSync(meetingChunksDir).filter(f => f.endsWith('.mkv'));
          const totalChunks = files.length;

          if (totalChunks > 0) {
            console.log(`[RECORDING] Auto-completing with ${totalChunks} chunks...`);
            // Fire and forget processing
            processRecording(rec.id, rec.roomId, rec.meetingId, totalChunks, '');
          } else {
            // Folder exists but no files
            await prisma.recording.update({
              where: { id: rec.id },
              data: { status: 'failed', failureReason: 'Abandoned: No chunks received' }
            });
          }
        } else {
          // No folder exists
          await prisma.recording.update({
            where: { id: rec.id },
            data: { status: 'failed', failureReason: 'Abandoned: Chunks folder missing' }
          });
        }
      }
    } catch (err) {
      console.error('[RECORDING] Auto-completer error:', err);
    }
  }, 60 * 1000); // Check every 60 seconds
};

