import { Elysia, t } from 'elysia';
import { signUp, signIn, getSession, signOut } from './config';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .post('/sign-up', async ({ body, set }) => {
    try {
      const user = await signUp(body.email, body.password, body.name);
      
      // Create session for new user
      const result = await signIn(body.email, body.password);
      if (result) {
        set.headers['Set-Cookie'] = `session=${result.session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
      }
      
      return { success: true, data: { user } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      name: t.String(),
    }),
  })

  .post('/sign-in', async ({ body, set }) => {
    try {
      const result = await signIn(body.email, body.password);
      if (!result) {
        return { error: 'Invalid email or password' };
      }
      
      // Set httpOnly cookie without Domain for localhost
      set.headers['Set-Cookie'] = `session=${result.session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
      
      console.log('Session cookie set for user:', result.user.email);
      
      return { success: true, data: { user: result.user, token: result.session.token } };
    } catch (error: any) {
      console.error('Sign-in error:', error);
      return { error: error.message };
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })

  .post('/sign-out', async ({ headers, set }) => {
    try {
      const authHeader = headers['authorization'];
      const cookieHeader = headers['cookie'];
      
      let token = '';
      
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
      } else if (cookieHeader) {
        const match = cookieHeader.match(/session=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }
      
      if (token) {
        await signOut(token);
      }
      
      // Clear cookie
      set.headers['Set-Cookie'] = `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
      
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  })

  .get('/get-session', async ({ headers }) => {
    try {
      const authHeader = headers['authorization'];
      const cookieHeader = headers['cookie'];
      
      let token = '';
      
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
      } else if (cookieHeader) {
        const match = cookieHeader.match(/session=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }
      
      if (!token) {
        return { error: 'No session token provided' };
      }
      
      const result = await getSession(token);
      if (!result) {
        return { error: 'Invalid or expired session' };
      }
      
      return { success: true, data: { user: result.user } };
    } catch (error: any) {
      return { error: error.message };
    }
  });
