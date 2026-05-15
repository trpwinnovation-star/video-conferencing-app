import { Router } from 'express';
import * as egressController from '../controllers/egress.controller';

const router = Router();

// Routes for server-side recording using LiveKit Egress
router.post('/start', egressController.startRecording);
router.post('/stop', egressController.stopRecording);

export default router;
