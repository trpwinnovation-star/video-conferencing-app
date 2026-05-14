import { Router } from 'express';
import { generateToken, createRoom, startRecording, stopRecording } from '../controllers/room.controller';

const router = Router();

router.post('/token', generateToken);
router.post('/create', createRoom);
router.post('/recording/start', startRecording);
router.post('/recording/stop', stopRecording);

export default router;
