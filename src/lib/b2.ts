import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const b2KeyId = process.env.B2_APPLICATION_KEY_ID;
const b2AppKey = process.env.B2_APPLICATION_KEY;
const b2Endpoint = process.env.B2_ENDPOINT;
const b2Bucket = process.env.B2_BUCKET_NAME;

let s3Client: S3Client | null = null;

function getS3Client() {
  if (s3Client) return s3Client;
  if (!b2KeyId || !b2AppKey || !b2Endpoint) {
    throw new Error('Missing Backblaze B2 configuration in environment variables.');
  }
  s3Client = new S3Client({
    endpoint: b2Endpoint,
    credentials: {
      accessKeyId: b2KeyId,
      secretAccessKey: b2AppKey,
    },
    region: b2Endpoint.split('.')[1] || 'us-east-005',
    forcePathStyle: true,
  });
  return s3Client;
}

export async function getUploadPresignedUrl(key: string, contentType: string, expiresIn: number = 900): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: b2Bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function getDownloadPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: b2Bucket,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn });
  } catch (err) {
    console.error('Failed to generate pre-signed download URL:', err);
    return '';
  }
}
