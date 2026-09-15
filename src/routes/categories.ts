import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const categoryRoutes = new Elysia({ prefix: '/api/categories' })
  .post('', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, body.workspaceId, 'categories.create');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const [category] = await db.insert(schema.categories).values({
        workspaceId: body.workspaceId,
        name: body.name,
        type: body.type,
        color: body.color || '#000000',
        icon: body.icon,
      }).returning();
      
      return { success: true, data: { category } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      name: t.String(),
      type: t.Union([t.Literal('income'), t.Literal('expense')]),
      color: t.Optional(t.String()),
      icon: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Categories'],
      summary: 'Create category',
      description: 'Create a new category in workspace. Requires owner or admin role.\n\n**Request Body:**\n```json\n{\n  "workspaceId": "workspace-uuid",\n  "name": "Food & Dining",\n  "type": "expense",\n  "color": "#EF4444",\n  "icon": "🍔"\n}\n```\n\n**Category Types:**\n- `income`: For income categories (Salary, Freelance, Investment)\n- `expense`: For expense categories (Food, Transportation, Utilities)\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "category": {\n      "id": "category-uuid",\n      "workspaceId": "workspace-uuid",\n      "name": "Food & Dining",\n      "type": "expense",\n      "color": "#EF4444",\n      "icon": "🍔",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('', async ({ headers, query, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    if (!query.workspaceId) {
      set.status = 400;
      return { success: false, error: 'workspaceId is required', code: 'VALIDATION_ERROR' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'categories.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const categories = await db.select().from(schema.categories)
        .where(and(
          eq(schema.categories.workspaceId, query.workspaceId),
          isNull(schema.categories.deletedAt)
        ));
      
      return { success: true, data: { categories } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['Categories'],
      summary: 'List categories',
      description: 'Get all categories in workspace. Requires workspace access (owner, admin, staff, member).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "categories": [\n      {\n        "id": "category-uuid-1",\n        "workspaceId": "workspace-uuid",\n        "name": "Salary",\n        "type": "income",\n        "color": "#10B981",\n        "icon": "💰",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      },\n      {\n        "id": "category-uuid-2",\n        "workspaceId": "workspace-uuid",\n        "name": "Food & Dining",\n        "type": "expense",\n        "color": "#EF4444",\n        "icon": "🍔",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, params.id));
    
    if (!category) {
      set.status = 404;
      return { success: false, error: 'Category not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, category.workspaceId, 'categories.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    return { success: true, data: { category } };
  }, {
    detail: {
      tags: ['Categories'],
      summary: 'Get category by ID',
      description: 'Get category details. Requires workspace access (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "category": {\n      "id": "category-uuid",\n      "workspaceId": "workspace-uuid",\n      "name": "Food & Dining",\n      "type": "expense",\n      "color": "#EF4444",\n      "icon": "🍔",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, params.id));
    
    if (!category) {
      set.status = 404;
      return { success: false, error: 'Category not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, category.workspaceId, 'categories.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const [updatedCategory] = await db.update(schema.categories)
        .set({
          name: body.name,
          type: body.type,
          color: body.color,
          icon: body.icon,
          updatedAt: new Date(),
        })
        .where(eq(schema.categories.id, params.id))
        .returning();
      
      return { success: true, data: { category: updatedCategory } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal('income'), t.Literal('expense')])),
      color: t.Optional(t.String()),
      icon: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Categories'],
      summary: 'Update category',
      description: 'Update category details. Requires owner or admin role.\n\n**Request Body:**\n```json\n{\n  "name": "Food & Dining Updated",\n  "type": "expense",\n  "color": "#F59E0B",\n  "icon": "🍕"\n}\n```\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "category": {\n      "id": "category-uuid",\n      "name": "Food & Dining Updated",\n      "type": "expense",\n      "color": "#F59E0B",\n      "icon": "🍕",\n      "updatedAt": "2026-09-14T15:30:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, params.id));
    
    if (!category) {
      set.status = 404;
      return { success: false, error: 'Category not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, category.workspaceId, 'categories.delete');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      await db.update(schema.categories)
        .set({
          deletedAt: new Date(),
          deletedBy: authResult.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.categories.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Categories'],
      summary: 'Delete category',
      description: 'Soft delete category (sets deletedAt timestamp). Requires owner or admin role. Category data is retained but marked as deleted.\n\n**Response:**\n```json\n{\n  "success": true\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  });
