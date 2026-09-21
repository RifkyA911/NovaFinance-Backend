import { GoogleGenerativeAI } from '@google/generative-ai';

const VECTOR_DIM = 768;

/**
 * Generate 768-dimensional text embedding using Google Gemini API
 * or fallback to deterministic normalized pseudo-embedding if API key is not configured.
 */
export async function getEmbedding(text: string, customApiKey?: string): Promise<number[]> {
  const apiKey = customApiKey || process.env.GOOGLE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  
  if (apiKey && apiKey.trim().length > 0) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(text);
      if (result.embedding?.values && result.embedding.values.length > 0) {
        return result.embedding.values;
      }
    } catch (err: any) {
      console.warn(`[Embedding] Gemini API failed (${err?.message || err}), falling back to deterministic vector.`);
    }
  }

  // Fallback: Deterministic 768-dim hash vector for offline / development mode
  return generateDeterministicEmbedding(text, VECTOR_DIM);
}

/**
 * Deterministic pseudo-embedding for testing or offline development.
 * Produces unit-length normalized vectors with cosine similarity reflecting word overlaps.
 */
function generateDeterministicEmbedding(text: string, dim: number = 768): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  
  if (words.length === 0) {
    vec[0] = 1.0;
    return vec;
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash * 31 + word.charCodeAt(j)) >>> 0;
    }
    const idx = hash % dim;
    const sign = (hash % 2 === 0) ? 1 : -1;
    vec[idx] += sign * (1 / (1 + i * 0.1));
    // Spread into adjacent dimension for smooth proximity
    vec[(idx + 1) % dim] += sign * 0.5;
  }

  // L2 Normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  } else {
    vec[0] = 1.0;
  }

  return vec;
}

/**
 * Format transaction data into an enriched semantic text for vector indexing
 */
export function formatTransactionText(tx: {
  type: string;
  amount: string | number;
  currency?: string;
  description?: string | null;
  categoryName?: string | null;
  accountName?: string | null;
  date?: string | Date | null;
  notes?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(`Tipe: ${tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`);
  parts.push(`Nominal: ${Number(tx.amount).toLocaleString('id-ID')} ${tx.currency || 'IDR'}`);
  if (tx.categoryName) parts.push(`Kategori: ${tx.categoryName}`);
  if (tx.accountName) parts.push(`Akun/Dompet: ${tx.accountName}`);
  if (tx.description) parts.push(`Deskripsi: ${tx.description}`);
  if (tx.notes) parts.push(`Catatan: ${tx.notes}`);
  if (tx.date) {
    const d = new Date(tx.date);
    parts.push(`Tanggal: ${d.toISOString().split('T')[0]}`);
  }
  return parts.join(' | ');
}

/**
 * Format document OCR text into an enriched semantic text for vector indexing
 */
export function formatDocumentText(doc: {
  fileName: string;
  merchant?: string | null;
  category?: string | null;
  total?: string | number | null;
  extractedText?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(`Dokumen Struk/Invoice: ${doc.fileName}`);
  if (doc.merchant) parts.push(`Merchant/Toko: ${doc.merchant}`);
  if (doc.category) parts.push(`Kategori: ${doc.category}`);
  if (doc.total) parts.push(`Total: Rp ${Number(doc.total).toLocaleString('id-ID')}`);
  if (doc.extractedText) parts.push(`Detail Teks: ${doc.extractedText}`);
  return parts.join(' | ');
}
