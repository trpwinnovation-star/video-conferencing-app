import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { processRecording } from '../services/recording.service';
import { generateSignedUrl } from '../services/s3.service';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const prisma = new PrismaClient();
const CHUNKS_DIR = path.join(os.tmpdir(), 'video-app-chunks');

export const startRecording = async (req: Request, res: Response) => {
  try {
    const { roomId, createdBy } = req.body;
    const meetingId = uuidv4();

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

    const chunkPath = path.join(meetingChunksDir, `${chunkIndex}.webm`);
    
    // Move file using copy + unlink to support cross-device moves on Render
    fs.copyFileSync(req.file.path, chunkPath);
    fs.unlinkSync(req.file.path);

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

export const getRecording = async (req: Request, res: Response) => {
  try {
    const recordingId = req.params.recordingId as string;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    if (recording.status === 'failed') {
      return res.status(400).json({ 
        error: 'Recording failed to process',
        details: recording.failureReason || 'The recording upload or processing encountered an error.',
        status: recording.status
      });
    }

    if (recording.status !== 'completed' || !recording.s3Key) {
      return res.status(202).json({ 
        error: `Recording is ${recording.status}`,
        details: `Current status: ${recording.status}. Please check back in a few moments.`,
        status: recording.status
      });
    }

    // Check expiry
    if (recording.downloadExpiresAt && new Date() > recording.downloadExpiresAt) {
      return res.status(403).json({ error: 'Download link has expired (5 days limit).' });
    }

    // Check download limit
    if (recording.downloadCount >= 3) {
      return res.status(403).json({ error: 'Maximum download limit reached (3 times).' });
    }

    // Generate a fresh signed URL valid for 1 hour
    const signedUrl = await generateSignedUrl(recording.s3Key, 3600);

    // Increment download count
    await prisma.recording.update({
      where: { id: recording.id },
      data: { downloadCount: { increment: 1 } },
    });

    res.status(200).json({ ...recording, signedUrl, downloadCount: recording.downloadCount + 1 });
  } catch (error) {
    console.error('Error fetching recording:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
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
