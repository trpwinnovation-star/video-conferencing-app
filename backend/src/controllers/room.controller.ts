import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db';
import { LivekitService } from '../services/livekit.service';
import {
  createProtectedRoom,
  verifyRoomPassword,
  getRoomOrThrow,
  getRoomAndVerifyPassword,
  ensureLivekitRoom,
  isValidRoomId,
  normalizeRoomId,
  deleteRoomFromDb,
} from '../services/room.service';

const livekitService = new LivekitService();

export const createProtectedRoomHandler = async (req: Request, res: Response) => {
  try {
    const { roomId, password } = req.body;
    if (!roomId || !password) {
      return res.status(400).json({ error: 'roomId and password are required' });
    }

    let createdBy: string | undefined;
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret') as { id: string };
        createdBy = decoded.id;
        console.log("token veified")
      } catch {
        // Invalid token
      }
    }

    if (!createdBy) {
      return res.status(401).json({ error: 'You must be signed in to create a meeting.' });
    }

    const room = await createProtectedRoom(roomId, password, createdBy);
    return res.status(201).json({
      room: { roomId: room.roomId, createdAt: room.createdAt },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create room';
    const status = message.includes('already exists') ? 409 : 400;
    return res.status(status).json({ error: message });
  }
};

export const verifyRoomPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { roomId, password } = req.body;
    if (!roomId || !password) {
      return res.status(400).json({ error: 'roomId and password are required' });
    }

    const id = normalizeRoomId(roomId);
    if (!isValidRoomId(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    await getRoomOrThrow(id);
    const valid = await verifyRoomPassword(id, password);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    return res.json({ verified: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return res.status(404).json({ error: message });
  }
};

export const generateToken = async (req: Request, res: Response) => {
  try {
    const { roomName, participantName, password } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Room password is required' });
    }

    // Validate participantName: max 50 chars, alphanumeric + spaces + common punctuation only
    const trimmedName = String(participantName).trim();
    if (trimmedName.length === 0 || trimmedName.length > 50) {
      return res.status(400).json({ error: 'Participant name must be 1–50 characters.' });
    }
    // Strip anything that looks like HTML tags to prevent XSS in the room UI
    if (/<[^>]+>/.test(trimmedName)) {
      return res.status(400).json({ error: 'Participant name must not contain HTML.' });
    }

    const roomId = normalizeRoomId(roomName);
    if (!isValidRoomId(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    // Single DB query: fetch room + verify password (was 2 separate queries before)
    const room = await getRoomAndVerifyPassword(roomId, password);

    // Determine if the requesting user is the room host
    let isHost = false;
    let jwtToken = req.cookies?.token;
    if (!jwtToken && req.headers.authorization?.startsWith('Bearer ')) {
      jwtToken = req.headers.authorization.substring(7);
    }
    if (jwtToken) {
      try {
        const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET || 'supersecret') as { id: string };
        isHost = room.createdBy === decoded.id;

        if (isHost) {
          // If it's a scheduled meeting, transition status to in_progress
          const scheduledMeeting = await prisma.scheduledMeeting.findUnique({
            where: { roomId }
          });
          if (scheduledMeeting && scheduledMeeting.status === 'scheduled') {
            await prisma.scheduledMeeting.update({
              where: { id: scheduledMeeting.id },
              data: {
                status: 'in_progress',
                hostJoinedAt: new Date(),
                actualStartTime: new Date(),
              }
            });
            console.log(`[Token] Updated scheduled meeting ${scheduledMeeting.id} to in_progress because host joined`);
          }
        }
      } catch {
        // Invalid or expired auth token — participant joins as non-host
      }
    }

    const token = await livekitService.generateToken(roomId, trimmedName, isHost);
    return res.json({ token });
  } catch (error) {
    // Only log full error detail in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Token] Error generating token:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to generate token';
    const status = message.includes('not found')      ? 404
                 : message.includes('Incorrect')      ? 401
                 : message.includes('Room is full')   ? 403
                 : 500;
    return res.status(status).json({ error: message });
  }
};

export const createRoom = async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    const room = await livekitService.createRoom(normalizeRoomId(roomName));
    return res.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ error: 'Failed to create room' });
  }
};

export const startRecording = async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    const info = await livekitService.startRecording(roomName);
    return res.json({ info });
  } catch (error: any) {
    console.error('Error starting recording:', error);
    return res.status(500).json({ error: error.message || 'Failed to start recording' });
  }
};

export const stopRecording = async (req: Request, res: Response) => {
  try {
    const { egressId } = req.body;

    if (!egressId) {
      return res.status(400).json({ error: 'egressId is required' });
    }

    const info = await livekitService.stopRecording(egressId);
    return res.json({ info });
  } catch (error: any) {
    console.error('Error stopping recording:', error);
    return res.status(500).json({ error: error.message || 'Failed to stop recording' });
  }
};

export const endMeeting = async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret') as { id: string };
    
    const roomId = normalizeRoomId(roomName);
    const room = await getRoomOrThrow(roomId);
    
    if (room.createdBy !== decoded.id) {
      return res.status(403).json({ error: 'Only the host can end the meeting' });
    }

    try {
      await livekitService.deleteRoom(roomId);
    } catch (livekitError: any) {
      console.warn('LiveKit room delete warning (maybe already deleted):', livekitError.message);
    }
    
    // Completely destroy the room so participants are fully kicked and can't rejoin
    await deleteRoomFromDb(roomId);
    
    return res.json({ message: 'Meeting ended successfully' });
  } catch (error: any) {
    console.error('Error ending meeting:', error);
    return res.status(500).json({ error: error.message || 'Failed to end meeting' });
  }
};

export const checkRoomStatus = async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    const roomId = normalizeRoomId(roomName);
    
    try {
      // Check if room exists in LiveKit
      const rooms = await livekitService.listRooms();
      const roomExists = rooms.some(r => r.name === roomId);
      
      return res.json({ 
        exists: roomExists,
        status: roomExists ? 'active' : 'deleted'
      });
    } catch (error) {
      console.warn('Error checking room status:', error);
      return res.status(500).json({ 
        error: 'Failed to check room status',
        status: 'unknown'
      });
    }
  } catch (error: any) {
    console.error('Error in checkRoomStatus:', error);
    return res.status(500).json({ error: error.message || 'Failed to check room status' });
  }
};

export const uploadSharedFileHandler = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    return res.status(200).json({
      message: 'File uploaded successfully',
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
};

