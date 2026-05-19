import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT || process.env.AWS_ENDPOINT || undefined, // Support MINIO_ENDPOINT
  forcePathStyle: true, // Always true for MinIO/custom endpoints
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'meeting-recordings';

/**
 * Upload a local file to S3
 */
export const uploadFileToS3 = async (localFilePath: string, s3Key: string): Promise<string> => {
  const fileStream = fs.createReadStream(localFilePath);
  
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: 'video/webm', // Or dynamically determined
  };

  await s3Client.send(new PutObjectCommand(uploadParams));
  return s3Key;
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
