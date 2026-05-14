import { Request, Response } from 'express';
import { LivekitService } from '../services/livekit.service';

const livekitService = new LivekitService();

export const generateToken = async (req: Request, res: Response) => {
  try {
    const { roomName, participantName } = req.body;
    
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    const token = await livekitService.generateToken(roomName, participantName);
    return res.json({ token });
  } catch (error) {
    console.error('DETAILED Error generating token:', error);
    return res.status(500).json({ 
      error: 'Failed to generate token', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
};

export const createRoom = async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    
    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    const room = await livekitService.createRoom(roomName);
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
    // Egress might fail if Livekit is not configured with Egress
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
