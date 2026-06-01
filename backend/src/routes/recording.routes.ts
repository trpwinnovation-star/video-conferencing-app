import { Router } from 'express';
import { startRecording, uploadChunk, finishRecording, getRecording, getMyRecordings } from '../controllers/recording.controller';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.post('/start', startRecording);
router.post('/upload-chunk', upload.single('chunk'), uploadChunk);
router.post('/finish', finishRecording);
router.get('/my', getMyRecordings);
router.get('/:recordingId', getRecording);

export default router;
