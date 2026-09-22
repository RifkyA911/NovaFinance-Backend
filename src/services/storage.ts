import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../auth/config';
import { documents } from '../db/schema';
import { sql } from 'drizzle-orm';

// ── Cloudflare R2 / MinIO Storage Configuration ──────────────────────────────
export const STORAGE_MAX_LIMIT_GB = Number(process.env.STORAGE_MAX_LIMIT_GB || 8);
export const MAX_STORAGE_LIMIT_BYTES = STORAGE_MAX_LIMIT_GB * 1024 * 1024 * 1024; // 8GB = 8,589,934,592 Bytes

const isR2 = Boolean(process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID);

export const s3Client = new S3Client({
  endpoint: process.env.R2_ENDPOINT || process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: process.env.R2_REGION || (isR2 ? 'auto' : 'us-east-1'),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY || 'minio',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY || 'minio123',
  },
  forcePathStyle: !isR2,
});

export const BUCKET_NAME = process.env.R2_BUCKET || process.env.MINIO_BUCKET || 'novajournal-documents';

// ── In-Memory Storage Cache ──────────────────────────────────────────────────
interface CacheEntry {
  totalBytes: number;
  totalObjects: number;
  lastChecked: number;
}

let cachedUsage: CacheEntry | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache to avoid excessive R2/MinIO API calls

// ── Helper: Format Bytes to Human Readable ───────────────────────────────────
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

export interface StorageUsageResult {
  provider: 'Cloudflare R2' | 'MinIO S3';
  bucket: string;
  limitBytes: number;
  limitGB: number;
  limitFormatted: string;
  usedBytes: number;
  usedFormatted: string;
  remainingBytes: number;
  remainingFormatted: string;
  usagePercentage: number;
  totalObjects: number;
  isExceeded: boolean;
  cached: boolean;
  timestamp: string;
}

// ── Calculate Live Storage Usage from R2 / MinIO ─────────────────────────────
export async function getStorageUsage(forceRefresh = false): Promise<StorageUsageResult> {
  const now = Date.now();

  if (!forceRefresh && cachedUsage && now - cachedUsage.lastChecked < CACHE_TTL_MS) {
    return buildUsageResponse(cachedUsage.totalBytes, cachedUsage.totalObjects, true);
  }

  let totalBytes = 0;
  let totalObjects = 0;

  try {
    let isTruncated: boolean | undefined = true;
    let continuationToken: string | undefined = undefined;

    // Paginate through bucket objects using ListObjectsV2
    while (isTruncated) {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        for (const item of response.Contents) {
          totalBytes += item.Size || 0;
          totalObjects += 1;
        }
      }

      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }

    cachedUsage = {
      totalBytes,
      totalObjects,
      lastChecked: now,
    };

    return buildUsageResponse(totalBytes, totalObjects, false);
  } catch (error: any) {
    console.warn(`[StorageGuard] Gagal memeriksa R2/MinIO via S3 API (${error?.message || error}), menggunakan fallback database.`);

    // Fallback: Query sum(fileSize) from documents table in database
    try {
      const [dbStat] = await db
        .select({
          totalSize: sql<number>`COALESCE(SUM(${documents.fileSize}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(documents);

      totalBytes = Number(dbStat?.totalSize || 0);
      totalObjects = Number(dbStat?.count || 0);

      cachedUsage = {
        totalBytes,
        totalObjects,
        lastChecked: now,
      };

      return buildUsageResponse(totalBytes, totalObjects, false);
    } catch (dbErr) {
      console.error('[StorageGuard] Fallback database query juga gagal:', dbErr);
      const fallbackBytes = cachedUsage?.totalBytes || 0;
      const fallbackObjects = cachedUsage?.totalObjects || 0;
      return buildUsageResponse(fallbackBytes, fallbackObjects, true);
    }
  }
}

function buildUsageResponse(usedBytes: number, totalObjects: number, cached: boolean): StorageUsageResult {
  const remainingBytes = Math.max(0, MAX_STORAGE_LIMIT_BYTES - usedBytes);
  const usagePercentage = Math.min(100, Number(((usedBytes / MAX_STORAGE_LIMIT_BYTES) * 100).toFixed(2)));
  const isExceeded = usedBytes >= MAX_STORAGE_LIMIT_BYTES;

  return {
    provider: isR2 ? 'Cloudflare R2' : 'MinIO S3',
    bucket: BUCKET_NAME,
    limitBytes: MAX_STORAGE_LIMIT_BYTES,
    limitGB: STORAGE_MAX_LIMIT_GB,
    limitFormatted: formatBytes(MAX_STORAGE_LIMIT_BYTES),
    usedBytes,
    usedFormatted: formatBytes(usedBytes),
    remainingBytes,
    remainingFormatted: formatBytes(remainingBytes),
    usagePercentage,
    totalObjects,
    isExceeded,
    cached,
    timestamp: new Date().toISOString(),
  };
}

// ── Storage Quota Guard: Enforces 8GB (or configured) hard limit ─────────────
export async function checkStorageQuotaGuard(incomingFileSizeBytes: number = 0): Promise<{
  allowed: boolean;
  error?: string;
  code?: string;
  usage: StorageUsageResult;
}> {
  const usage = await getStorageUsage(false);
  const prospectiveTotalBytes = usage.usedBytes + incomingFileSizeBytes;

  if (prospectiveTotalBytes > MAX_STORAGE_LIMIT_BYTES) {
    const incomingFormatted = formatBytes(incomingFileSizeBytes);
    const errorMsg = `Kapasitas penyimpanan ${usage.provider} melebihi batas kuota ${usage.limitFormatted}! ` +
      `(Terpakai: ${usage.usedFormatted}, Sisa: ${usage.remainingFormatted}, Ukuran file baru: ${incomingFormatted}). ` +
      `Silakan hapus file atau dokumen lama sebelum melanjutkan unggahan.`;

    console.warn(`[StorageGuard] ⛔ Unggahan diblokir: ${errorMsg}`);

    return {
      allowed: false,
      code: 'STORAGE_QUOTA_EXCEEDED',
      error: errorMsg,
      usage,
    };
  }

  return {
    allowed: true,
    usage,
  };
}

// ── Cache Updates on Successful Upload / Delete ──────────────────────────────
export function recordUpload(fileSizeBytes: number) {
  if (cachedUsage) {
    cachedUsage.totalBytes += Math.max(0, fileSizeBytes);
    cachedUsage.totalObjects += 1;
    cachedUsage.lastChecked = Date.now();
  }
}

export function recordDelete(fileSizeBytes: number) {
  if (cachedUsage) {
    cachedUsage.totalBytes = Math.max(0, cachedUsage.totalBytes - fileSizeBytes);
    cachedUsage.totalObjects = Math.max(0, cachedUsage.totalObjects - 1);
    cachedUsage.lastChecked = Date.now();
  }
}
