import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { LivekitService } from '../services/livekit.service';
import {
  createProtectedRoom,
  verifyRoomPassword,
  getRoomOrThrow,
  ensureLivekitRoom,
  isValidRoomId,
  normalizeRoomId,
} from '../services/room.service';

const livekitService = new LivekitService();

export const createProtectedRoomHandler = async (req: Request, res: Response) => {
  try {
    const { roomId, password } = req.body;
    if (!roomId || !password) {
      return res.status(400).json({ error: 'roomId and password are required' });
    }

    let createdBy: string | undefined;
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret') as { id: string };
        createdBy = decoded.id;
      } catch {
        // guest creator
      }
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

    const roomId = normalizeRoomId(roomName);
    if (!isValidRoomId(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    await getRoomOrThrow(roomId);
    const valid = await verifyRoomPassword(roomId, password);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    await ensureLivekitRoom(roomId);
    const token = await livekitService.generateToken(roomId, participantName);
    return res.json({ token });
  } catch (error) {
    console.error('DETAILED Error generating token:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate token';
    const status = message.includes('not found') ? 404 : 500;
    return res.status(status).json({
      error: message,
      details: error instanceof Error ? error.message : String(error),
    });
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
