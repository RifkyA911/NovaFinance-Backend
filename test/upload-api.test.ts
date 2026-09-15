import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { apiDocumentRoutes } from '../src/routes/documents';

describe('Document Upload API Tests', () => {
  const app = new Elysia().use(apiDocumentRoutes);

  it('should return 401 when unauthenticated', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['receipt content'], { type: 'text/plain' }), 'receipt.txt');
    formData.append('filename', 'receipt.txt');
    formData.append('workspaceId', 'ws-fake-id');

    const res = await app.handle(new Request('http://localhost/api/documents/upload', {
      method: 'POST',
      body: formData,
    }));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should reject upload if required fields are missing', async () => {
    const formData = new FormData();
    formData.append('filename', 'receipt.txt');

    const res = await app.handle(new Request('http://localhost/api/documents/upload', {
      method: 'POST',
      body: formData,
    }));

    // Elysia schema validation returns 422 or 400
    expect([400, 422]).toContain(res.status);
  });
});
