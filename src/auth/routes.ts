import { Elysia, t } from 'elysia';
import { auth } from './index';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  // BetterAuth native endpoints (hidden from Swagger to prevent duplicate endpoints)
  .post('/sign-in/email', async ({ request }) => {
    return auth.handler(request);
  }, {
    detail: { hide: true },
  })
  .post('/sign-up/email', async ({ request }) => {
    return auth.handler(request);
  }, {
    detail: { hide: true },
  })
  .post('/sign-out', async ({ request }) => {
    return auth.handler(request);
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Sign out',
      description: 'End current user session. Invalidates session token and clears session cookie.\n\n**Response:**\n```json\n{\n  "success": true\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })
  .get('/get-session', async ({ request }) => {
    return auth.handler(request);
  }, {
    detail: { hide: true },
  })
  // Convenience aliases
  .post('/sign-in', async ({ request, body }) => {
    const url = new URL(request.url);
    url.pathname = '/api/auth/sign-in/email';
    const newRequest = new Request(url.toString(), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(body),
    });
    return auth.handler(newRequest);
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
    detail: {
      tags: ['Auth'],
      summary: 'Sign in',
      description: 'Authenticate with email and password to receive session token.\n\n**Dummy Accounts:**\n- admin@example.com / admin123 (Owner role)\n- test@example.com / password123 (Owner role)\n- user@example.com / password123 (Admin role)\n- staff@example.com / staff123 (Staff role)\n\n**Response:**\n```json\n{\n  "redirect": false,\n  "token": "QVlDklTsp7s4CLnody5dwWxE5MC9lMX6",\n  "user": {\n    "id": "user-uuid",\n    "name": "Admin User",\n    "email": "admin@example.com",\n    "emailVerified": false,\n    "image": null,\n    "createdAt": "2026-09-14T14:15:12.057Z",\n    "updatedAt": "2026-09-14T14:15:12.057Z"\n  }\n}\n```',
      security: [],
    },
  })
  .post('/sign-up', async ({ request, body }) => {
    const url = new URL(request.url);
    url.pathname = '/api/auth/sign-up/email';
    const newRequest = new Request(url.toString(), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(body),
    });
    return auth.handler(newRequest);
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      name: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Auth'],
      summary: 'Sign up',
      description: 'Create new user account with email, password, and optional name.\n\n**Request Body:**\n```json\n{\n  "email": "newuser@example.com",\n  "password": "securePassword123",\n  "name": "John Doe"\n}\n```\n\n**Response:**\n```json\n{\n  "redirect": false,\n  "token": "new-session-token",\n  "user": {\n    "id": "user-uuid",\n    "name": "John Doe",\n    "email": "newuser@example.com",\n    "emailVerified": false,\n    "createdAt": "2026-09-14T15:00:00.000Z"\n  }\n}\n```',
      security: [],
    },
  })
  .get('/session', async ({ request }) => {
    const url = new URL(request.url);
    url.pathname = '/api/auth/get-session';
    return auth.handler(new Request(url.toString(), request));
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Get session',
      description: 'Get current user session information. Requires valid session token in Authorization header or cookie.\n\n**Response:**\n```json\n{\n  "user": {\n    "id": "user-uuid",\n    "name": "Admin User",\n    "email": "admin@example.com",\n    "emailVerified": false,\n    "createdAt": "2026-09-14T14:15:12.057Z"\n  },\n  "session": {\n    "id": "session-uuid",\n    "userId": "user-uuid",\n    "expiresAt": "2026-09-15T14:15:12.057Z"\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })
  // Wildcard fallback (catch-all for other BetterAuth endpoints, hidden from Swagger)
  .all('/*', async ({ request }) => {
    return auth.handler(request);
  }, {
    detail: { hide: true },
  });
