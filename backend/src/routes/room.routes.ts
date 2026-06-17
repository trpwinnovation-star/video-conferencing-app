import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  generateToken,
  createRoom,
  createProtectedRoomHandler,
  verifyRoomPasswordHandler,
  startRecording,
  stopRecording,
  endMeeting,
  checkRoomStatus,
  uploadSharedFileHandler,
} from '../controllers/room.controller';

const router = Router();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const roomId = String(req.query.roomId || 'unknown');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `room-${roomId}-shared-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

router.post('/create-protected', createProtectedRoomHandler);
router.post('/verify-password', verifyRoomPasswordHandler);
router.post('/token', generateToken);
router.post('/create', createRoom);
router.post('/recording/start', startRecording);
router.post('/recording/stop', stopRecording);
router.post('/end-meeting', endMeeting);
router.post('/check-status', checkRoomStatus);
router.post('/upload-file', fileUpload.single('file'), uploadSharedFileHandler);

export default router;
