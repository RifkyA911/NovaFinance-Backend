import { Elysia, t } from "elysia";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// MinIO S3 Client
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minio',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minio123',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = 'novajournal-documents';

// Ensure bucket exists
async function ensureBucket() {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: '.bucket-init',
      Body: '',
    }));
  } catch (error) {
    // Bucket might already exist, ignore error
  }
}

ensureBucket();

export const documentRoutes = new Elysia({ prefix: '/documents' })
  .post('/upload', async ({ body }) => {
    try {
      const { file, filename, transactionId, documentType, workspaceId } = body as any;

      if (!file || !filename || !workspaceId) {
        return { error: 'Missing required fields' };
      }

      const key = `${workspaceId}/${transactionId || 'unlinked'}/${Date.now()}-${filename}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: file.type || 'application/octet-stream',
      });

      await s3Client.send(command);

      // Generate presigned URL for immediate access
      const getUrlCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, getUrlCommand, { expiresIn: 3600 });

      return {
        success: true,
        key,
        url,
        filename,
        documentType,
        transactionId,
      };
    } catch (error) {
      console.error('Upload error:', error);
      return { error: 'Upload failed', details: error };
    }
  }, {
    body: t.Object({
      file: t.Any(),
      filename: t.String(),
      transactionId: t.Optional(t.String()),
      documentType: t.Optional(t.String()),
      workspaceId: t.String(),
    }),
  })

  .get('/list/:workspaceId', async ({ params }) => {
    try {
      const { workspaceId } = params;

      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: `${workspaceId}/`,
      });

      const response = await s3Client.send(command);

      const documents = response.Contents?.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
      })) || [];

      return { documents };
    } catch (error) {
      console.error('List error:', error);
      return { error: 'Failed to list documents' };
    }
  })

  .get('/download/:key', async ({ params }) => {
    try {
      const { key } = params;

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return { url };
    } catch (error) {
      console.error('Download error:', error);
      return { error: 'Failed to generate download URL' };
    }
  })

  .delete('/:key', async ({ params }) => {
    try {
      const { key } = params;

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);

      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return { error: 'Failed to delete document' };
    }
  });
