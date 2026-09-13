import { describe, it, expect, beforeAll } from 'bun:test';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

// MinIO S3 Client
const s3Client = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minio',
    secretAccessKey: 'minio123',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = 'novajournal-documents';

describe('MinIO Upload Tests', () => {
  beforeAll(async () => {
    // Create bucket if it doesn't exist
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      console.log('Bucket already exists');
    } catch (error) {
      console.log('Bucket does not exist, creating...');
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        console.log('Bucket created successfully');
      } catch (createError) {
        console.error('Failed to create bucket:', createError);
      }
    }
  });

  it('should connect to MinIO', async () => {
    const testKey = `test/${Date.now()}-connection-test.txt`;
    const testContent = 'MinIO connection test';

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
      });

      await s3Client.send(command);

      // Clean up
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      });
      await s3Client.send(deleteCommand);

      expect(true).toBe(true);
    } catch (error) {
      console.error('MinIO connection failed:', error);
      throw error;
    }
  });

  it('should upload a file to MinIO', async () => {
    const testKey = `test/${Date.now()}-upload-test.txt`;
    const testContent = 'Test file content for upload';

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    const result = await s3Client.send(command);

    expect(result).toBeDefined();
    expect(result.$metadata.httpStatusCode).toBe(200);

    // Clean up
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    await s3Client.send(deleteCommand);
  });

  it('should upload a buffer to MinIO', async () => {
    const testKey = `test/${Date.now()}-buffer-test.bin`;
    const testBuffer = Buffer.from('Test buffer content');

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testBuffer,
      ContentType: 'application/octet-stream',
      ContentLength: testBuffer.length,
    });

    const result = await s3Client.send(command);

    expect(result).toBeDefined();
    expect(result.$metadata.httpStatusCode).toBe(200);

    // Clean up
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    await s3Client.send(deleteCommand);
  });

  it('should upload with workspace and transaction ID structure', async () => {
    const workspaceId = 'test-workspace';
    const transactionId = 'test-transaction';
    const filename = 'receipt.png';
    const testKey = `${workspaceId}/${transactionId}/${Date.now()}-${filename}`;
    const testBuffer = Buffer.from('Test image content');

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testBuffer,
      ContentType: 'image/png',
      ContentLength: testBuffer.length,
    });

    const result = await s3Client.send(command);

    expect(result).toBeDefined();
    expect(result.$metadata.httpStatusCode).toBe(200);

    // Clean up
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    await s3Client.send(deleteCommand);
  });
});
