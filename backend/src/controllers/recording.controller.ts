import { Request, Response } from 'express';
import { prisma } from '../lib/db';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { processRecording } from '../services/recording.service';
import { getS3ObjectStream } from '../services/s3.service';


const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const CHUNKS_DIR = path.join(os.tmpdir(), 'video-app-chunks');

export const startRecording = async (req: Request, res: Response) => {
  try {
    const { roomId, createdBy: bodyCreatedBy } = req.body;
    let meetingId = uuidv4();

    const scheduledMeeting = await prisma.scheduledMeeting.findUnique({
      where: { roomId }
    });
    if (scheduledMeeting) {
      meetingId = scheduledMeeting.id;
    }

    // Prefer the authenticated user's name from JWT over the client-supplied value
    let createdBy = bodyCreatedBy;
    try {
      let token = req.cookies?.token;
      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      }
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as { name: string };
        if (decoded?.name) createdBy = decoded.name;
      }
    } catch {
      // Not authenticated — fall back to body value (guests)
    }

    const recording = await prisma.recording.create({
      data: {
        roomId,
        meetingId,
        createdBy,
        status: 'recording',
      },
    });

    res.status(200).json({ recordingId: recording.id, meetingId });
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
};

export const uploadChunk = async (req: Request, res: Response) => {
  try {
    const { meetingId, chunkIndex } = req.body;

    if (!req.file || !meetingId || chunkIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const meetingChunksDir = path.join(CHUNKS_DIR, meetingId);
    if (!fs.existsSync(meetingChunksDir)) {
      fs.mkdirSync(meetingChunksDir, { recursive: true });
    }

    const chunkPath = path.join(meetingChunksDir, `${chunkIndex}.mkv`);

    // Move file using copy + unlink to support cross-device moves on Render
    fs.copyFileSync(req.file.path, chunkPath);
    fs.unlinkSync(req.file.path);

    // Heartbeat: Touch the database record to update the `updatedAt` timestamp
    // This tells the auto-finisher cron job that the recording is still alive
    await prisma.recording.updateMany({
      where: { meetingId, status: 'recording' },
      data: { updatedAt: new Date() },
    });

    res.status(200).json({ message: 'Chunk uploaded successfully' });
  } catch (error) {
    console.error('Error uploading chunk:', error);
    res.status(500).json({ error: 'Failed to upload chunk' });
  }
};

export const finishRecording = async (req: Request, res: Response) => {
  try {
    const { recordingId, roomId, meetingId, totalChunks, email } = req.body;

    if (!recordingId || !meetingId || totalChunks === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process asynchronously, do not await here to avoid blocking the request
    processRecording(recordingId, roomId, meetingId, totalChunks, email);

    res.status(200).json({ message: 'Recording finish initiated' });
  } catch (error) {
    console.error('Error finishing recording:', error);
    res.status(500).json({ error: 'Failed to finish recording' });
  }
};

/**
 * Returns recording metadata only — does NOT increment downloadCount.
 * Used for displaying info on the page without wasting a download slot.
 */
export const getRecordingInfo = async (req: Request, res: Response) => {
  try {
    const recordingId = req.params.recordingId as string;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Strip the s3Key from the public response
    const { s3Key, ...safeRecording } = recording as any;

    return res.status(200).json({ ...safeRecording });
  } catch (error) {
    console.error('Error fetching recording info:', error);
    return res.status(500).json({ error: 'Failed to fetch recording info' });
  }
};

/**
 * STRICT PROXY DOWNLOAD — the only way to download a recording file.
 *
 * Flow:
 *   1. Authenticate the request via JWT
 *   2. Check expiry and download limit (reject 403 if either exceeded)
 *   3. Atomically increment downloadCount BEFORE streaming
 *   4. Fetch the file from S3 server-side and pipe bytes directly to the browser
 *
 * The S3 URL is NEVER sent to the client — every byte passes through this endpoint.
 * This means the 3-download limit is enforced on every single download attempt,
 * with no loopholes.
 */
export const downloadRecording = async (req: Request, res: Response) => {
  try {
    const recordingId = req.params.recordingId as string;

    // ── 1. Auth ──────────────────────────────────────────────────────────
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    jwt.verify(token, JWT_SECRET); // throws if invalid

    // ── 2. Load recording ────────────────────────────────────────────────
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    if (recording.status !== 'completed' || !recording.s3Key) {
      return res.status(400).json({ error: 'Recording is not ready for download.' });
    }

    // ── 3. Expiry check ──────────────────────────────────────────────────
    if (recording.downloadExpiresAt && new Date() > recording.downloadExpiresAt) {
      return res.status(403).json({ error: 'Download link has expired (5-day limit).' });
    }

    // ── 4. Download limit check ───────────────────────────────────────────
    if (recording.downloadCount >= 3) {
      return res.status(403).json({ error: 'Maximum download limit reached (3 downloads).' });
    }

    // ── 5. Atomically increment BEFORE streaming ─────────────────────────
    //    Incrementing first ensures that even if the stream is aborted mid-way,
    //    the attempt is still counted (prevents retry-spam loopholes).
    const updated = await prisma.recording.update({
      where: { id: recordingId },
      data: { downloadCount: { increment: 1 } },
    });

    // ── 6. Fetch from S3 and stream directly to browser ──────────────────
    const { stream, contentLength, contentType } = await getS3ObjectStream(recording.s3Key);

    const fileName = `Recording-${recording.roomId}-${recording.createdAt.toISOString().slice(0, 10)}.webm`;

    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Download-Count', updated.downloadCount);
    res.setHeader('X-Downloads-Remaining', Math.max(0, 3 - updated.downloadCount));
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Pipe S3 stream → HTTP response
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('[DOWNLOAD] S3 stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error — please try again.' });
      }
    });

  } catch (error: any) {
    console.error('Error streaming recording:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download recording' });
    }
  }
};

/**
 * Kept for backward compatibility with the /recordings/[id] page.
 * Returns metadata only — does NOT stream or expose the S3 URL.
 * (Identical to getRecordingInfo — both are safe to call on page load.)
 */
export const getRecording = async (req: Request, res: Response) => {
  return getRecordingInfo(req, res);
};

export const getMyRecordings = async (req: Request, res: Response) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { name: string };

    const recordings = await prisma.recording.findMany({
      where: { createdBy: decoded.name },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ recordings });
  } catch (error) {
    console.error('Error fetching my recordings:', error);
    return res.status(500).json({ error: 'Failed to fetch recordings' });
  }
};

export const getRecordingsByMeetingId = async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.params;
    const recordings = await prisma.recording.findMany({
      where: { meetingId: String(meetingId) },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ recordings });
  } catch (error: any) {
    console.error('Error fetching meeting recordings:', error);
    return res.status(500).json({ error: 'Failed to fetch recordings for this meeting' });
  }
};
