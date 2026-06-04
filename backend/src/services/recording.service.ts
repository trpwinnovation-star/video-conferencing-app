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
 * Instantly fixes WebM playback (missing duration/unskippable) by regenerating cues
 * This is 100x faster than converting to MP4 because it doesn't re-encode the video.
 */
const fixWebmPlayback = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`[RECORDING] Starting instant ffmpeg WebM playback fix...`);
    ffmpeg(inputPath)
      .outputOptions([
        '-c copy',           // Just copies the raw video/audio (no heavy re-encoding)
      ])
      .save(outputPath)
      .on('end', () => {
        console.log(`[RECORDING] WebM playback fix finished instantly.`);
        resolve();
      })
      .on('error', (err) => {
        console.error('[RECORDING] ffmpeg WebM fix error:', err);
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

    // 2.5 Fix the WebM playback issue (duration/skipping) instantly
    const finalFilePath = path.join(MERGED_DIR, `${meetingId}-fixed.webm`);
    await fixWebmPlayback(mergedFilePath, finalFilePath);

    if (!fs.existsSync(finalFilePath)) {
      throw new Error(`Critical Error: Fixed WebM file was not created.`);
    }

    const stats = fs.statSync(finalFilePath);
    console.log(`[RECORDING] Final WEBM video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // 3. Upload to S3
    const s3Key = `meeting-recordings/${roomId}/${meetingId}.webm`;
    await uploadFileToS3(finalFilePath, s3Key);

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

