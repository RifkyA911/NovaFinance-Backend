import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';

export const menuRoutes = new Elysia({ prefix: '/api/workspaces' })
  // GET: List all active menus for workspace
  .get(
    '/:id/menus',
    async ({ params: { id }, headers, set }: any) => {
      const workspaceId = id;
      const authResult = await requireAuth(headers);
      if (authResult.error || !authResult.user) {
        set.status = authResult.status || 401;
        return { success: false, error: authResult.error || 'Authentication failed' };
      }

      const accessResult = await requireWorkspaceAccess(authResult.user.id, workspaceId, 'menus.read');
      if (accessResult.error) {
        set.status = accessResult.status || 403;
        return { success: false, error: accessResult.error };
      }

      try {
        const workspaceMenus = await db
          .select()
          .from(schema.menus)
          .where(
            and(
              eq(schema.menus.workspaceId, workspaceId),
              eq(schema.menus.isActive, true)
            )
          )
          .orderBy(asc(schema.menus.order));

        return {
          success: true,
          data: workspaceMenus,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          error: error.message || 'Failed to fetch workspace menus',
        };
      }
    },
    {
      detail: {
        tags: ['Menus'],
        summary: 'Get dynamic navigation menus for workspace',
        description: 'Fetch ordered list of active sidebar navigation menu items configured for the specified workspace.',
        security: [{ BearerAuth: [] }],
      },
    }
  )

  // POST: Create or upsert a menu item
  .post(
    '/:id/menus',
    async ({ params: { id }, body, headers, set }: any) => {
      const workspaceId = id;
      const authResult = await requireAuth(headers);
      if (authResult.error || !authResult.user) {
        set.status = authResult.status || 401;
        return { success: false, error: authResult.error || 'Authentication failed' };
      }

      const accessResult = await requireWorkspaceAccess(authResult.user.id, workspaceId, 'menus.create');
      if (accessResult.error) {
        set.status = accessResult.status || 403;
        return { success: false, error: accessResult.error };
      }

      try {
        const [newMenu] = await db
          .insert(schema.menus)
          .values({
            workspaceId,
            name: body.name,
            label: body.label,
            icon: body.icon,
            path: body.path,
            order: body.order ?? 0,
            group: body.group ?? 'overview',
            permissions: body.permissions ?? ['read'],
            isActive: body.isActive ?? true,
          })
          .returning();

        return {
          success: true,
          data: newMenu,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          error: error.message || 'Failed to create menu item',
        };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        label: t.String(),
        icon: t.Optional(t.String()),
        path: t.Optional(t.String()),
        order: t.Optional(t.Number()),
        permissions: t.Optional(t.Array(t.String())),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Menus'],
        summary: 'Create or configure navigation menu item for workspace',
        description: 'Add a new navigation menu item with custom label, icon, group, and route path to a workspace.',
        security: [{ BearerAuth: [] }],
      },
    }
  );
