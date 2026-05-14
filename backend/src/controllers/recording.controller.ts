import { Request, Response } from 'express';

export const uploadRecording = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = `/uploads/${req.file.filename}`;
    
    return res.status(200).json({
      message: 'Recording uploaded successfully',
      filePath: filePath,
      fileName: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error in uploadRecording controller:', error);
    return res.status(500).json({ error: 'Failed to save recording' });
  }
};
