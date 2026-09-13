import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const workspaceRoutes = new Elysia({ prefix: '/api/workspaces' })
  .post('/', async ({ body, headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    try {
      const [workspace] = await db.insert(schema.workspaces).values({
        ownerId: auth.user.id,
        name: body.name,
        type: body.type,
        currency: body.currency || 'IDR',
      }).returning();
      
      // Add owner as collaborator
      await db.insert(schema.collaborators).values({
        workspaceId: workspace.id,
        userId: auth.user.id,
        role: 'owner',
        invitedBy: auth.user.id,
      });
      
      return { success: true, data: { workspace } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      name: t.String(),
      type: t.Union([t.Literal('personal'), t.Literal('umkm'), t.Literal('pt')]),
      currency: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Workspaces'],
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/', async ({ headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      console.log('Workspace GET auth failed:', auth.error);
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    console.log('Workspace GET for user:', auth.user.id, auth.user.email);
    
    try {
      // Get workspaces where user is owner or collaborator
      const ownedWorkspaces = await db.select().from(schema.workspaces)
        .where(and(
          eq(schema.workspaces.ownerId, auth.user.id),
          isNull(schema.workspaces.deletedAt)
        ));
      
      console.log('Owned workspaces:', ownedWorkspaces.length);
      
      const collaboratorWorkspaces = await db.select({
        workspace: schema.workspaces,
        role: schema.collaborators.role,
      }).from(schema.collaborators)
        .innerJoin(schema.workspaces, eq(schema.collaborators.workspaceId, schema.workspaces.id))
        .where(and(
          eq(schema.collaborators.userId, auth.user.id),
          isNull(schema.workspaces.deletedAt)
        ));
      
      console.log('Collaborator workspaces:', collaboratorWorkspaces.length);
      
      // Deduplicate workspaces by ID (user might be both owner and collaborator)
      const workspaceMap = new Map();
      ownedWorkspaces.forEach(w => workspaceMap.set(w.id, { ...w, role: 'owner' }));
      collaboratorWorkspaces.forEach(c => {
        if (!workspaceMap.has(c.workspace.id)) {
          workspaceMap.set(c.workspace.id, { ...c.workspace, role: c.role });
        }
      });
      
      const workspaces = Array.from(workspaceMap.values());
      
      console.log('Total workspaces (deduplicated):', workspaces.length);
      
      return { success: true, data: { workspaces } };
    } catch (error: any) {
      console.error('Workspace GET error:', error);
      return { error: error.message };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, params.id, 'workspaces.read');
    if (access.error) {
      set.status = access.status || 403;
      return { error: access.error };
    }
    
    return { success: true, data: { workspace: access.workspace, role: access.role } };
  }, {
    detail: {
      tags: ['Workspaces'],
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, params.id, 'workspaces.update');
    if (access.error) {
      set.status = access.status || 403;
      return { error: access.error };
    }
    
    try {
      const [workspace] = await db.update(schema.workspaces)
        .set({
          name: body.name,
          type: body.type,
          currency: body.currency,
          updatedAt: new Date(),
        })
        .where(eq(schema.workspaces.id, params.id))
        .returning();
      
      return { success: true, data: { workspace } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal('personal'), t.Literal('umkm'), t.Literal('pt')])),
      currency: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Workspaces'],
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:id', async ({ params, headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, params.id, 'workspaces.delete');
    if (access.error) {
      set.status = access.status || 403;
      return { error: access.error };
    }
    
    try {
      await db.update(schema.workspaces)
        .set({
          deletedAt: new Date(),
          deletedBy: auth.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.workspaces.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      security: [{ BearerAuth: [] }],
    },
  });
