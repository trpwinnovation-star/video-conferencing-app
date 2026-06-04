import { Request, Response } from 'express';
import * as egressService from '../services/egress.service';

export const startRecording = async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    console.log(`Controller: Starting Egress for room: "${roomName}"`);
    const info = await egressService.startRoomRecording(roomName);
    return res.status(200).json({
      message: 'Recording started',
      egressId: info.egressId,
      info
    });
  } catch (error: any) {
    console.error('Error in startRecording controller:', error);
    return res.status(500).json({
      error: 'Failed to start recording',
      details: error.message || 'No error message',
      fullError: error,
      help: 'Check your LIVEKIT_URL and API keys in Render dashboard'
    });
  }
};

export const stopRecording = async (req: Request, res: Response) => {
  try {
    const { egressId } = req.body;
    if (!egressId) {
      return res.status(400).json({ error: 'egressId is required' });
    }

    const info = await egressService.stopRoomRecording(egressId);
    return res.status(200).json({
      message: 'Recording stopped',
      egressId: info.egressId,
      info
    });
  } catch (error: any) {
    console.error('Error in stopRecording controller:', error);
    return res.status(500).json({
      error: 'Failed to stop recording',
      details: error.message
    });
  }
};
