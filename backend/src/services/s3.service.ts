import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from "@smithy/node-http-handler";
import fs from 'fs';
import path from 'path';

// Configure S3 Client for Production
const s3Config: any = {
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT || process.env.AWS_ENDPOINT || undefined, 
  forcePathStyle: true, 
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 600000, // 10 minutes for large file uploads
    socketTimeout: 600000,
  }),
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

const s3Client = new S3Client(s3Config);

// Production Middleware: Inject ngrok bypass header into EVERY request
s3Client.middlewareStack.add(
  (next, context) => (args: any) => {
    args.request.headers["ngrok-skip-browser-warning"] = "true";
    return next(args);
  },
  {
    step: "build",
  }
);

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || 'meeting-recordings';

/**
 * Ensures the target bucket exists, creating it if necessary (MinIO compatible)
 */
export const ensureBucketExists = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`[S3] Bucket '${BUCKET_NAME}' already exists.`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Bucket '${BUCKET_NAME}' not found. Creating...`);
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`[S3] Bucket '${BUCKET_NAME}' created successfully.`);
      } catch (createError: any) {
        console.error(`[S3] Failed to create bucket: ${createError.message}`);
      }
    } else {
      console.error(`[S3] Error checking bucket existence:`, error.message);
    }
  }
};

/**
 * Upload a local file to S3
 */
export const uploadFileToS3 = async (localFilePath: string, s3Key: string): Promise<string> => {
  await ensureBucketExists();
  
  const fileStream = fs.createReadStream(localFilePath);
  
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: 'video/webm',
  };

  console.log(`[S3] Uploading to bucket: ${BUCKET_NAME}, key: ${s3Key}`);
  
  try {
    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log(`[S3] Upload successful`);
    return s3Key;
  } catch (error) {
    console.error(`[S3] Upload failed:`, error);
    throw error;
  }
};

/**
 * Generate a pre-signed URL for downloading/viewing a file in S3
 */
export const generateSignedUrl = async (s3Key: string, expiresInSeconds: number = 24 * 60 * 60): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};
