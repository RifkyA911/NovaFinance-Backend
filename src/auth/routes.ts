import { Elysia, t } from 'elysia';
import { auth } from './index';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .post('/sign-in', async ({ request, set }) => {
    const response = await auth.handler(request);
    
    response.headers.forEach((value, key) => {
      set.headers[key] = value;
    });
    
    set.status = response.status;
    const responseBody = await response.text();
    return responseBody;
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
    detail: {
      tags: ['Auth'],
      summary: 'Sign in with email and password',
      description: 'Authenticate user and return session token',
      security: [],
    },
  })
  .post('/sign-up', async ({ request, set }) => {
    const response = await auth.handler(request);
    
    response.headers.forEach((value, key) => {
      set.headers[key] = value;
    });
    
    set.status = response.status;
    const responseBody = await response.text();
    return responseBody;
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      name: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Auth'],
      summary: 'Sign up new user',
      description: 'Create a new user account',
      security: [],
    },
  })
  .post('/sign-out', async ({ request, set }) => {
    const response = await auth.handler(request);
    
    response.headers.forEach((value, key) => {
      set.headers[key] = value;
    });
    
    set.status = response.status;
    const responseBody = await response.text();
    return responseBody;
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Sign out user',
      description: 'End user session',
      security: [{ BearerAuth: [] }],
    },
  })
  .get('/session', async ({ request, set }) => {
    const response = await auth.handler(request);
    
    response.headers.forEach((value, key) => {
      set.headers[key] = value;
    });
    
    set.status = response.status;
    const responseBody = await response.text();
    return responseBody;
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Get current session',
      description: 'Get current user session information',
      security: [{ BearerAuth: [] }],
    },
  });
