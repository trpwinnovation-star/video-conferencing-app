import { Router } from 'express';
import { uploadRecording } from '../controllers/recording.controller';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.post('/upload', upload.single('recording'), uploadRecording);

export default router;
