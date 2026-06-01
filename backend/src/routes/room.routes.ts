import { Router } from 'express';
import {
  generateToken,
  createRoom,
  createProtectedRoomHandler,
  verifyRoomPasswordHandler,
  startRecording,
  stopRecording,
  endMeeting,
} from '../controllers/room.controller';

const router = Router();

router.post('/create-protected', createProtectedRoomHandler);
router.post('/verify-password', verifyRoomPasswordHandler);
router.post('/token', generateToken);
router.post('/create', createRoom);
router.post('/recording/start', startRecording);
router.post('/recording/stop', stopRecording);
router.post('/end-meeting', endMeeting);

export default router;
