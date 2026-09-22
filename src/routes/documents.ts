import { Elysia, t } from "elysia";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { db } from '../auth/config';
import { documents } from '../db/schema';
import { analyzeDocument } from '../services/gemini';
import { eq } from 'drizzle-orm';
import {
  s3Client,
  BUCKET_NAME,
  checkStorageQuotaGuard,
  recordUpload,
  recordDelete,
  getStorageUsage,
} from '../services/storage';

// Ensure bucket exists
async function ensureBucket() {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: '.bucket-init',
      Body: Buffer.from(''),
    }));
  } catch {
    // Bucket might already exist, ignore error
  }
}

ensureBucket();

const baseDocumentRoutes = new Elysia()
  .post('/upload', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const { file, filename, workspaceId, transactionId } = body;

      if (!file || !filename || !workspaceId) {
        set.status = 400;
        return { success: false, error: 'Missing required fields', code: 'VALIDATION_ERROR' };
      }

      // Check workspace access
      const workspaceAccess = await requireWorkspaceAccess(authResult.user.id, workspaceId);
      if (workspaceAccess.error) {
        set.status = workspaceAccess.status || 403;
        return { success: false, error: workspaceAccess.error, code: 'FORBIDDEN' };
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `NovaFinance/workspaces/${workspaceId}/documents/${year}/${month}/${transactionId ? `tx_${transactionId}` : 'unlinked'}/${Date.now()}_${safeFilename}`;

      // Convert File to ArrayBuffer then Buffer
      const arrayBuffer = await file.arrayBuffer();
      const bodyBuffer = Buffer.from(arrayBuffer);

      // ── Storage Quota Guard (8GB Limit for R2 / MinIO) ──
      const quotaCheck = await checkStorageQuotaGuard(bodyBuffer.length);
      if (!quotaCheck.allowed) {
        set.status = 413; // Payload Too Large
        return {
          success: false,
          error: quotaCheck.error,
          code: quotaCheck.code,
          data: {
            storageUsage: quotaCheck.usage,
          },
        };
      }

      // Upload to MinIO / Cloudflare R2
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: bodyBuffer,
        ContentType: file.type || 'application/octet-stream',
        ContentLength: bodyBuffer.length,
      });

      await s3Client.send(command);
      recordUpload(bodyBuffer.length);

      // Generate presigned URL for immediate access
      const getUrlCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, getUrlCommand, { expiresIn: 3600 });

      // Analyze with Gemini if it's an image
      let metadata = null;
      if (file.type.startsWith('image/')) {
        try {
          metadata = await analyzeDocument(bodyBuffer, file.type);
        } catch (error) {
          console.error('Gemini analysis failed, continuing without metadata:', error);
          metadata = { error: 'Analysis failed', confidence: 0 };
        }
      }

      // Store in database
      const [document] = await db.insert(documents).values({
        workspaceId,
        transactionId: transactionId || null,
        fileName: filename,
        fileUrl: url,
        fileType: file.type,
        fileSize: bodyBuffer.length,
        minioKey: key,
        metadata,
        uploadedBy: authResult.user.id,
      }).returning();

      return {
        success: true,
        data: {
          document,
          url,
        },
      };
    } catch (error) {
      console.error('Upload error:', error);
      set.status = 500;
      return { success: false, error: 'Upload failed', code: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    body: t.Object({
      file: t.File(),
      filename: t.String(),
      workspaceId: t.String(),
      transactionId: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Documents'],
      summary: 'Upload document',
      description: 'Upload a document to workspace with AI analysis. Document will be analyzed by Gemini to extract metadata (amount, date, vendor, etc.). Requires owner, admin, or staff role.',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/list/:workspaceId', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const { workspaceId } = params;

      // Check workspace access
      const workspaceAccess = await requireWorkspaceAccess(authResult.user.id, workspaceId);
      if (workspaceAccess.error) {
        set.status = workspaceAccess.status || 403;
        return { success: false, error: workspaceAccess.error, code: 'FORBIDDEN' };
      }

      // Query from database
      const docs = await db.select().from(documents).where(eq(documents.workspaceId, workspaceId));

      return { success: true, data: { documents: docs } };
    } catch (error) {
      console.error('List error:', error);
      set.status = 500;
      return { success: false, error: 'Failed to list documents', code: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    detail: {
      tags: ['Documents'],
      summary: 'List documents',
      description: 'Get all documents in workspace with extracted metadata. Requires workspace access (owner, admin, staff, member).',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/download/:key', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const { key } = params;

      // Get document from database to check workspace access
      const [doc] = await db.select().from(documents).where(eq(documents.minioKey, key));
      if (!doc) {
        set.status = 404;
        return { success: false, error: 'Document not found', code: 'NOT_FOUND' };
      }

      // Check workspace access
      const workspaceAccess = await requireWorkspaceAccess(authResult.user.id, doc.workspaceId);
      if (workspaceAccess.error) {
        set.status = workspaceAccess.status || 403;
        return { success: false, error: workspaceAccess.error, code: 'FORBIDDEN' };
      }

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return { success: true, data: { url, document: doc } };
    } catch (error) {
      console.error('Download error:', error);
      set.status = 500;
      return { success: false, error: 'Failed to generate download URL', code: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    detail: {
      tags: ['Documents'],
      summary: 'Download document',
      description: 'Generate presigned URL to download document with metadata. Requires workspace access (owner, admin, staff, member).',
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:key', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const { key } = params;

      // Get document from database to check workspace access
      const [doc] = await db.select().from(documents).where(eq(documents.minioKey, key));
      if (!doc) {
        set.status = 404;
        return { success: false, error: 'Document not found', code: 'NOT_FOUND' };
      }

      // Check workspace access (owner, admin, staff only)
      const workspaceAccess = await requireWorkspaceAccess(authResult.user.id, doc.workspaceId);
      if (workspaceAccess.error || (workspaceAccess.role !== 'owner' && workspaceAccess.role !== 'admin' && workspaceAccess.role !== 'staff')) {
        set.status = workspaceAccess.status || 403;
        return { success: false, error: 'Access denied', code: 'FORBIDDEN' };
      }

      // Delete from MinIO / Cloudflare R2
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);

      // Delete from database
      await db.delete(documents).where(eq(documents.minioKey, key));
      recordDelete(doc.fileSize || 0);

      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      set.status = 500;
      return { success: false, error: 'Failed to delete document', code: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    detail: {
      tags: ['Documents'],
      summary: 'Delete document',
      description: 'Delete document from workspace and MinIO storage. Requires owner, admin, or staff role.',
      security: [{ BearerAuth: [] }],
    },
  })

  // ── Storage Status (R2 / MinIO 8GB Quota Monitor) ──
  .get('/storage-status', async ({ headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const usage = await getStorageUsage(true);
      return { success: true, data: usage };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: 'Failed to retrieve storage status', code: 'STORAGE_ERROR', details: error?.message };
    }
  }, {
    detail: {
      tags: ['Documents'],
      summary: 'Get storage usage and 8GB quota status (Cloudflare R2 / MinIO)',
      description: 'Returns total used bytes, remaining capacity towards 8GB limit, object count, and usage percentage.',
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const { id } = params;
      const [doc] = await db.select().from(documents).where(eq(documents.id, id));
      if (!doc) {
        set.status = 404;
        return { success: false, error: 'Document not found', code: 'NOT_FOUND' };
      }

      const workspaceAccess = await requireWorkspaceAccess(authResult.user.id, doc.workspaceId);
      if (workspaceAccess.error) {
        set.status = workspaceAccess.status || 403;
        return { success: false, error: workspaceAccess.error, code: 'FORBIDDEN' };
      }

      const [updated] = await db.update(documents)
        .set({
          transactionId: body.transactionId,
        })
        .where(eq(documents.id, id))
        .returning();

      return { success: true, data: { document: updated } };
    } catch (error) {
      console.error('Update document error:', error);
      set.status = 500;
      return { success: false, error: 'Failed to update document', code: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    body: t.Object({
      transactionId: t.String(),
    }),
    detail: {
      tags: ['Documents'],
      summary: 'Link document to transaction',
      description: 'Update document to link with a transaction ID.',
      security: [{ BearerAuth: [] }],
    },
  });

export const documentRoutes = new Elysia({ prefix: '/documents' })
  .use(baseDocumentRoutes);

export const apiDocumentRoutes = new Elysia({ prefix: '/api/documents' })
  .use(baseDocumentRoutes);

