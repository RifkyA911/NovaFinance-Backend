import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';

export const categoryRoutes = new Elysia({ prefix: '/api/categories' })
  .post('/', async ({ body, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, body.workspaceId, 'categories.create');
    if (access.error) {
      return { error: access.error };
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
      return { error: error.message };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      name: t.String(),
      type: t.Union([t.Literal('income'), t.Literal('expense')]),
      color: t.Optional(t.String()),
      icon: t.Optional(t.String()),
    }),
  })

  .get('/', async ({ headers, query }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      return { error: 'workspaceId is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'categories.read');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const categories = await db.select().from(schema.categories)
        .where(and(
          eq(schema.categories.workspaceId, query.workspaceId),
          isNull(schema.categories.deletedAt)
        ));
      
      return { success: true, data: { categories } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
  })

  .get('/:id', async ({ params, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, params.id));
    
    if (!category) {
      return { error: 'Category not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, category.workspaceId, 'categories.read');
    if (access.error) {
      return { error: access.error };
    }
    
    return { success: true, data: { category } };
  })

  .patch('/:id', async ({ params, body, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, params.id));
    
    if (!category) {
      return { error: 'Category not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, category.workspaceId, 'categories.update');
    if (access.error) {
      return { error: access.error };
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
      return { error: error.message };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal('income'), t.Literal('expense')])),
      color: t.Optional(t.String()),
      icon: t.Optional(t.String()),
    }),
  })

  .delete('/:id', async ({ params, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, params.id));
    
    if (!category) {
      return { error: 'Category not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, category.workspaceId, 'categories.delete');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      await db.update(schema.categories)
        .set({
          deletedAt: new Date(),
          deletedBy: auth.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.categories.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  });
