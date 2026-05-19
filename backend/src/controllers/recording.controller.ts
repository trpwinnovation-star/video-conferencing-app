import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { processRecording } from '../services/recording.service';
import { generateSignedUrl } from '../services/s3.service';

const prisma = new PrismaClient();
const CHUNKS_DIR = path.join(__dirname, '../../uploads/chunks');

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

    // Move file from general uploads to chunks directory
    const chunkPath = path.join(meetingChunksDir, `${chunkIndex}.webm`);
    fs.renameSync(req.file.path, chunkPath);

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
    const { recordingId } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    if (recording.status !== 'completed' || !recording.s3Key) {
      return res.status(400).json({ error: `Recording is ${recording.status}` });
    }

    // Generate a fresh signed URL valid for 1 hour
    const signedUrl = await generateSignedUrl(recording.s3Key, 3600);

    res.status(200).json({ ...recording, signedUrl });
  } catch (error) {
    console.error('Error fetching recording:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
};
