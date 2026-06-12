import { Router } from 'express';
import { startRecording, uploadChunk, finishRecording, getRecording, getRecordingInfo, downloadRecording, getMyRecordings, getRecordingsByMeetingId } from '../controllers/recording.controller';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.post('/start', startRecording);
router.post('/upload-chunk', upload.single('chunk'), uploadChunk);
router.post('/finish', finishRecording);
router.get('/my', getMyRecordings);
// Specific routes BEFORE the wildcard /:recordingId
router.get('/meeting/:meetingId', getRecordingsByMeetingId);
router.get('/:recordingId/info', getRecordingInfo);
router.get('/:recordingId/download', downloadRecording);  // ← strict proxy, no S3 URL exposed
router.get('/:recordingId', getRecording);                // ← metadata only (backward compat)

export default router;
