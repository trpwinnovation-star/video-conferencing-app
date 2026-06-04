import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
require("dotenv").config({ path: path.join(__dirname, ".env") });
const region =
  process.env.DEV_AWS_REGION ||
  'us-east-1';

const accessKeyId =
  process.env.DEV_AWS_ACCESS_KEY_ID ||
  '';

const secretAccessKey =
  process.env.DEV_AWS_SECRET_ACCESS_KEY ||
  '';




const BUCKET_NAME =
  process.env.DEV_AWS_BUCKET_NAME;

const s3Client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },

  requestHandler: new NodeHttpHandler({
    connectionTimeout: 600_000,
    socketTimeout: 600_000,
  }),
});



/**
 * Ensures the target bucket exists. Auto-creates only for MinIO/custom endpoints.
 */
export const ensureBucketExists = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`[S3] Bucket '${BUCKET_NAME}' is accessible.`);
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number }; message?: string };



    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Bucket '${BUCKET_NAME}' not found. Creating...`);
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`[S3] Bucket '${BUCKET_NAME}' created successfully.`);
      } catch (createError: unknown) {
        const createErr = createError as { message?: string };
        console.error(`[S3] Failed to create bucket: ${createErr.message}`);
      }
    } else {
      console.error(`[S3] Error checking bucket existence:`, err.message);
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
    ContentType: 'video/mp4',
  };

  console.log(`[S3] Uploading to bucket: ${BUCKET_NAME}, key: ${s3Key}, region: ${region}`);

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
export const generateSignedUrl = async (
  s3Key: string,
  expiresInSeconds: number = 24 * 60 * 60
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

/**
 * Fetches a file from S3 and returns a readable stream along with metadata.
 * Used by the backend proxy download endpoint — the S3 URL is NEVER sent to the client.
 */
export const getS3ObjectStream = async (
  s3Key: string
): Promise<{ stream: Readable; contentLength?: number; contentType?: string }> => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('S3 returned empty body');
  }

  return {
    stream: response.Body as Readable,
    contentLength: response.ContentLength,
    contentType: response.ContentType || 'video/mp4',
  };
};
