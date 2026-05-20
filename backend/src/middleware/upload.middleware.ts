import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Use system temp directory for more reliable writing on cloud platforms
const uploadDir = path.join(os.tmpdir(), 'video-app-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Browsers often send variations like video/webm;codecs=vp8
  // We allow anything starting with video/ or octet-stream for blobs
  if (file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream') {
    cb(null, true);
  } else {
    console.error(`[UPLOAD] Rejected invalid mimetype: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only video files are allowed.`) as any, false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});
