import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';

export const goalRoutes = new Elysia({ prefix: '/api/goals' })
  // 1. Create a new financial goal
  .post('', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, body.workspaceId, 'goals.create');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      // Find current max order to append to the end
      const [maxOrderItem] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${schema.goals.order}), 0)` })
        .from(schema.goals)
        .where(and(eq(schema.goals.workspaceId, body.workspaceId), isNull(schema.goals.deletedAt)));

      const nextOrder = (maxOrderItem?.maxOrder || 0) + 1;

      const [newGoal] = await db.insert(schema.goals).values({
        workspaceId: body.workspaceId,
        title: body.title,
        category: body.category,
        targetAmount: String(body.targetAmount),
        currentAmount: String(body.currentAmount || 0),
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        priority: body.priority || 'medium',
        order: body.order ?? nextOrder,
        status: body.status || 'in_progress',
        monthlyContributionPlanned: String(body.monthlyContributionPlanned || 0),
        notes: body.notes || null,
        metadata: body.metadata || null,
      }).returning();

      return { success: true, data: { goal: newGoal } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      title: t.String(),
      category: t.String(),
      targetAmount: t.Union([t.String(), t.Number()]),
      currentAmount: t.Optional(t.Union([t.String(), t.Number()])),
      targetDate: t.Optional(t.String()),
      priority: t.Optional(t.Union([t.Literal('urgent'), t.Literal('high'), t.Literal('medium'), t.Literal('low')])),
      order: t.Optional(t.Number()),
      status: t.Optional(t.Union([t.Literal('in_progress'), t.Literal('completed'), t.Literal('wishlist'), t.Literal('paused')])),
      monthlyContributionPlanned: t.Optional(t.Union([t.String(), t.Number()])),
      notes: t.Optional(t.String()),
      metadata: t.Optional(t.Any()),
    }),
    detail: {
      tags: ['Goals'],
      summary: 'Create financial goal or wishlist item',
      description: 'Create a new financial goal with priority, target amount, planned contribution, and target date.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 2. Batch Reorder goals (Drag and Drop persistence)
  .put('/reorder', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, body.workspaceId, 'goals.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      await db.transaction(async (tx) => {
        for (const item of body.items) {
          const updateData: Record<string, any> = {
            order: item.order,
            updatedAt: new Date(),
          };
          if (item.priority) updateData.priority = item.priority;
          if (item.status) updateData.status = item.status;

          await tx
            .update(schema.goals)
            .set(updateData)
            .where(and(eq(schema.goals.id, item.id), eq(schema.goals.workspaceId, body.workspaceId)));
        }
      });

      return { success: true, message: 'Goals order synchronized successfully' };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      items: t.Array(t.Object({
        id: t.String(),
        order: t.Number(),
        priority: t.Optional(t.String()),
        status: t.Optional(t.String()),
      })),
    }),
    detail: {
      tags: ['Goals'],
      summary: 'Batch reorder goals (Drag & Drop)',
      description: 'Update the order, priority column, or status of multiple goals simultaneously for drag-and-drop kanban boards.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 3. Analytics & Portfolio breakdown for goals
  .get('/analytics', async ({ headers, query, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    if (!query.workspaceId) {
      set.status = 400;
      return { success: false, error: 'workspaceId is required', code: 'BAD_REQUEST' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'goals.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      const allGoals = await db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.workspaceId, query.workspaceId), isNull(schema.goals.deletedAt)));

      let totalTarget = 0;
      let totalCurrent = 0;
      let totalMonthlyPlanned = 0;

      const statusCounts = {
        in_progress: 0,
        completed: 0,
        wishlist: 0,
        paused: 0,
      };

      const priorityCounts = {
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

      const categoryMap: Record<string, { totalTarget: number; totalCurrent: number; count: number }> = {};

      for (const g of allGoals) {
        const target = parseFloat(g.targetAmount as string) || 0;
        const current = parseFloat(g.currentAmount as string) || 0;
        const monthly = parseFloat(g.monthlyContributionPlanned as string) || 0;

        totalTarget += target;
        totalCurrent += current;
        totalMonthlyPlanned += monthly;

        const st = (g.status || 'in_progress') as keyof typeof statusCounts;
        if (statusCounts[st] !== undefined) statusCounts[st]++;

        const pr = (g.priority || 'medium') as keyof typeof priorityCounts;
        if (priorityCounts[pr] !== undefined) priorityCounts[pr]++;

        const cat = g.category || 'other';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { totalTarget: 0, totalCurrent: 0, count: 0 };
        }
        categoryMap[cat].totalTarget += target;
        categoryMap[cat].totalCurrent += current;
        categoryMap[cat].count += 1;
      }

      const overallCompletionRate = totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0;

      const categoryBreakdown = Object.entries(categoryMap).map(([category, stats]) => ({
        category,
        totalTarget: stats.totalTarget,
        totalCurrent: stats.totalCurrent,
        count: stats.count,
        targetSharePercentage: totalTarget > 0 ? ((stats.totalTarget / totalTarget) * 100).toFixed(1) : '0',
        completionPercentage: stats.totalTarget > 0 ? Math.min(100, (stats.totalCurrent / stats.totalTarget) * 100).toFixed(1) : '0',
      })).sort((a, b) => b.totalTarget - a.totalTarget);

      return {
        success: true,
        data: {
          totalGoals: allGoals.length,
          totalTargetAmount: totalTarget,
          totalCurrentAmount: totalCurrent,
          overallCompletionRate: Number(overallCompletionRate.toFixed(2)),
          totalMonthlyPlanned,
          statusCounts,
          priorityCounts,
          categoryBreakdown,
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['Goals'],
      summary: 'Get goals analytics and portfolio breakdown',
      description: 'Calculate aggregated goals metrics including completion rates, category diversification, priority distribution, and planned monthly savings velocity.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 4. List all goals for a workspace
  .get('', async ({ headers, query, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    if (!query.workspaceId) {
      set.status = 400;
      return { success: false, error: 'workspaceId is required', code: 'BAD_REQUEST' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'goals.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      const conditions = [
        eq(schema.goals.workspaceId, query.workspaceId),
        isNull(schema.goals.deletedAt),
      ];

      if (query.status && query.status !== 'all') {
        conditions.push(eq(schema.goals.status, query.status));
      }
      if (query.priority && query.priority !== 'all') {
        conditions.push(eq(schema.goals.priority, query.priority));
      }
      if (query.category && query.category !== 'all') {
        conditions.push(eq(schema.goals.category, query.category));
      }

      const results = await db
        .select()
        .from(schema.goals)
        .where(and(...conditions))
        .orderBy(asc(schema.goals.order), desc(schema.goals.createdAt));

      return {
        success: true,
        data: {
          goals: results,
          total: results.length,
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
      status: t.Optional(t.String()),
      priority: t.Optional(t.String()),
      category: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Goals'],
      summary: 'List financial goals',
      description: 'Get all active financial goals with optional filters by status, priority, or category.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 5. Get single goal
  .get('/:id', async ({ headers, params, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const [goal] = await db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.id, params.id), isNull(schema.goals.deletedAt)));

      if (!goal) {
        set.status = 404;
        return { success: false, error: 'Goal not found', code: 'NOT_FOUND' };
      }

      const access = await requireWorkspaceAccess(authResult.user.id, goal.workspaceId, 'goals.read');
      if (access.error) {
        set.status = access.status || 403;
        return { success: false, error: access.error, code: 'FORBIDDEN' };
      }

      return { success: true, data: { goal } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ['Goals'],
      summary: 'Get single goal details',
      security: [{ BearerAuth: [] }],
    },
  })

  // 6. Quick deposit / top-up progress
  .post('/:id/deposit', async ({ headers, params, body, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const [goal] = await db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.id, params.id), isNull(schema.goals.deletedAt)));

      if (!goal) {
        set.status = 404;
        return { success: false, error: 'Goal not found', code: 'NOT_FOUND' };
      }

      const access = await requireWorkspaceAccess(authResult.user.id, goal.workspaceId, 'goals.update');
      if (access.error) {
        set.status = access.status || 403;
        return { success: false, error: access.error, code: 'FORBIDDEN' };
      }

      const depositAmount = parseFloat(String(body.amount));
      if (isNaN(depositAmount) || depositAmount <= 0) {
        set.status = 400;
        return { success: false, error: 'Deposit amount must be greater than 0', code: 'BAD_REQUEST' };
      }

      const updated = await db.transaction(async (tx) => {
        // Atomic SQL balance addition to avoid float race conditions
        const [result] = await tx
          .update(schema.goals)
          .set({
            currentAmount: sql`${schema.goals.currentAmount} + ${depositAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(schema.goals.id, goal.id))
          .returning();

        // Check if goal has now achieved target, update status to completed if appropriate
        const newCurrent = parseFloat(result.currentAmount as string);
        const target = parseFloat(result.targetAmount as string);
        if (newCurrent >= target && result.status === 'in_progress') {
          const [completedResult] = await tx
            .update(schema.goals)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(eq(schema.goals.id, goal.id))
            .returning();
          return completedResult;
        }

        return result;
      });

      return { success: true, data: { goal: updated } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      amount: t.Union([t.String(), t.Number()]),
      accountId: t.Optional(t.String()),
      note: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Goals'],
      summary: 'Deposit funds to goal',
      description: 'Quickly add funds to a financial goal with atomic SQL arithmetic. Automatically sets status to completed if target is reached.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 7. Update goal
  .patch('/:id', async ({ headers, params, body, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const [goal] = await db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.id, params.id), isNull(schema.goals.deletedAt)));

      if (!goal) {
        set.status = 404;
        return { success: false, error: 'Goal not found', code: 'NOT_FOUND' };
      }

      const access = await requireWorkspaceAccess(authResult.user.id, goal.workspaceId, 'goals.update');
      if (access.error) {
        set.status = access.status || 403;
        return { success: false, error: access.error, code: 'FORBIDDEN' };
      }

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (body.title !== undefined) updateData.title = body.title;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.targetAmount !== undefined) updateData.targetAmount = String(body.targetAmount);
      if (body.currentAmount !== undefined) updateData.currentAmount = String(body.currentAmount);
      if (body.targetDate !== undefined) updateData.targetDate = body.targetDate ? new Date(body.targetDate) : null;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.order !== undefined) updateData.order = body.order;
      if (body.monthlyContributionPlanned !== undefined) updateData.monthlyContributionPlanned = String(body.monthlyContributionPlanned);
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;

      const [updated] = await db
        .update(schema.goals)
        .set(updateData)
        .where(eq(schema.goals.id, params.id))
        .returning();

      return { success: true, data: { goal: updated } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      title: t.Optional(t.String()),
      category: t.Optional(t.String()),
      targetAmount: t.Optional(t.Union([t.String(), t.Number()])),
      currentAmount: t.Optional(t.Union([t.String(), t.Number()])),
      targetDate: t.Optional(t.Union([t.String(), t.Null()])),
      priority: t.Optional(t.Union([t.Literal('urgent'), t.Literal('high'), t.Literal('medium'), t.Literal('low')])),
      status: t.Optional(t.Union([t.Literal('in_progress'), t.Literal('completed'), t.Literal('wishlist'), t.Literal('paused')])),
      order: t.Optional(t.Number()),
      monthlyContributionPlanned: t.Optional(t.Union([t.String(), t.Number()])),
      notes: t.Optional(t.String()),
      metadata: t.Optional(t.Any()),
    }),
    detail: {
      tags: ['Goals'],
      summary: 'Update goal details',
      security: [{ BearerAuth: [] }],
    },
  })

  // 8. Delete goal (soft delete)
  .delete('/:id', async ({ headers, params, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    try {
      const [goal] = await db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.id, params.id), isNull(schema.goals.deletedAt)));

      if (!goal) {
        set.status = 404;
        return { success: false, error: 'Goal not found', code: 'NOT_FOUND' };
      }

      const access = await requireWorkspaceAccess(authResult.user.id, goal.workspaceId, 'goals.delete');
      if (access.error) {
        set.status = access.status || 403;
        return { success: false, error: access.error, code: 'FORBIDDEN' };
      }

      await db
        .update(schema.goals)
        .set({
          deletedAt: new Date(),
          deletedBy: authResult.user.id,
        })
        .where(eq(schema.goals.id, params.id));

      return { success: true, message: 'Goal deleted successfully' };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ['Goals'],
      summary: 'Delete goal (Soft delete)',
      security: [{ BearerAuth: [] }],
    },
  });
