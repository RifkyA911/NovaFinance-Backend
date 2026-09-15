import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const workspaceRoutes = new Elysia({ prefix: '/api/workspaces' })
  .post('', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    try {
      const [workspace] = await db.insert(schema.workspaces).values({
        ownerId: authResult.user.id,
        name: body.name,
        type: body.type,
        currency: body.currency || 'IDR',
      }).returning();
      
      // Add owner as collaborator
      await db.insert(schema.collaborators).values({
        workspaceId: workspace.id,
        userId: authResult.user.id,
        role: 'owner',
        invitedBy: authResult.user.id,
      });
      
      return { success: true, data: { workspace } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      name: t.String(),
      type: t.Union([t.Literal('personal'), t.Literal('umkm'), t.Literal('pt')]),
      currency: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Create workspace',
      description: 'Create a new workspace. User becomes the owner with full permissions (owner, admin, staff, member roles).\n\n**Request Body:**\n```json\n{\n  "name": "Personal Finance",\n  "type": "personal",\n  "currency": "IDR"\n}\n```\n\n**Workspace Types:**\n- `personal`: Personal finance tracking\n- `umkm`: Small business management\n- `pt`: Corporate entity management\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspace": {\n      "id": "workspace-uuid",\n      "ownerId": "user-uuid",\n      "name": "Personal Finance",\n      "type": "personal",\n      "currency": "IDR",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('', async ({ headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    try {
      // Get workspaces where user is owner or collaborator
      const ownedWorkspaces = await db.select().from(schema.workspaces)
        .where(and(
          eq(schema.workspaces.ownerId, authResult.user.id),
          isNull(schema.workspaces.deletedAt)
        ));
      
      const collaboratorWorkspaces = await db.select({
        workspace: schema.workspaces,
        role: schema.collaborators.role,
      }).from(schema.collaborators)
        .innerJoin(schema.workspaces, eq(schema.collaborators.workspaceId, schema.workspaces.id))
        .where(and(
          eq(schema.collaborators.userId, authResult.user.id),
          isNull(schema.workspaces.deletedAt)
        ));
      
      // Deduplicate workspaces by ID (user might be both owner and collaborator)
      const workspaceMap = new Map();
      ownedWorkspaces.forEach(w => workspaceMap.set(w.id, { ...w, role: 'owner' }));
      collaboratorWorkspaces.forEach(c => {
        if (!workspaceMap.has(c.workspace.id)) {
          workspaceMap.set(c.workspace.id, { ...c.workspace, role: c.role });
        }
      });
      
      const workspaces = Array.from(workspaceMap.values());
      
      return { success: true, data: { workspaces } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'List user workspaces',
      description: 'Get all workspaces where user is owner or collaborator. Returns user role for each workspace (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspaces": [\n      {\n        "id": "workspace-uuid-1",\n        "name": "Personal Finance",\n        "type": "personal",\n        "currency": "IDR",\n        "role": "owner",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      },\n      {\n        "id": "workspace-uuid-2",\n        "name": "Business Operations",\n        "type": "umkm",\n        "currency": "IDR",\n        "role": "admin",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    return { success: true, data: { workspace: access.workspace, role: access.role } };
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'Get workspace by ID',
      description: 'Get workspace details and user role. Requires workspace access (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspace": {\n      "id": "workspace-uuid",\n      "ownerId": "user-uuid",\n      "name": "Personal Finance",\n      "type": "personal",\n      "currency": "IDR",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    },\n    "role": "owner"\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal('personal'), t.Literal('umkm'), t.Literal('pt')])),
      currency: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Update workspace',
      description: 'Update workspace details. Requires owner or admin role.\n\n**Request Body:**\n```json\n{\n  "name": "Personal Finance Updated",\n  "type": "personal",\n  "currency": "USD"\n}\n```\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspace": {\n      "id": "workspace-uuid",\n      "name": "Personal Finance Updated",\n      "type": "personal",\n      "currency": "USD",\n      "updatedAt": "2026-09-14T15:30:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.delete');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      await db.update(schema.workspaces)
        .set({
          deletedAt: new Date(),
          deletedBy: authResult.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.workspaces.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'Delete workspace',
      description: 'Soft delete workspace (sets deletedAt timestamp). Requires owner role only. Workspace data is retained but marked as deleted.\n\n**Response:**\n```json\n{\n  "success": true\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  });
