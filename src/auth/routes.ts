import { Elysia, t } from 'elysia';
import { auth } from './index';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .all('/*', async ({ request, set }) => {
    const url = new URL(request.url);
    const method = request.method;
    
    // BetterAuth handles all auth routes
    const response = await auth.handler(new Request(url.toString(), {
      method,
      headers: request.headers,
      body: method !== 'GET' ? await request.text() : undefined,
    }));
    
    // Copy headers
    response.headers.forEach((value, key) => {
      set.headers[key] = value;
    });
    
    set.status = response.status;
    return await response.text();
  });
