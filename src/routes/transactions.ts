import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';

export const transactionRoutes = new Elysia({ prefix: '/api/transactions' })
  .post('/', async ({ body, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, body.workspaceId, 'transactions.create');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const [transaction] = await db.insert(schema.transactions).values({
        workspaceId: body.workspaceId,
        accountId: body.accountId,
        categoryId: body.categoryId,
        amount: body.amount,
        type: body.type,
        description: body.description,
        date: body.date ? new Date(body.date) : new Date(),
        notes: body.notes,
        metadata: body.metadata,
        isStaging: body.isStaging || false,
      }).returning();
      
      return { success: true, data: { transaction } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      accountId: t.String(),
      categoryId: t.Optional(t.String()),
      amount: t.String(),
      type: t.Union([t.Literal('income'), t.Literal('expense')]),
      description: t.String(),
      date: t.Optional(t.String()),
      notes: t.Optional(t.String()),
      metadata: t.Optional(t.Any()),
      isStaging: t.Optional(t.Boolean()),
    }),
  })

  .get('/', async ({ headers, query }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      return { error: 'workspaceId query parameter is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const limit = query.limit ? parseInt(query.limit) : 50;
      
      const transactions = await db.select({
        id: schema.transactions.id,
        workspaceId: schema.transactions.workspaceId,
        accountId: schema.transactions.accountId,
        categoryId: schema.transactions.categoryId,
        amount: schema.transactions.amount,
        type: schema.transactions.type,
        description: schema.transactions.description,
        notes: schema.transactions.notes,
        date: schema.transactions.date,
        metadata: schema.transactions.metadata,
        isStaging: schema.transactions.isStaging,
        createdAt: schema.transactions.createdAt,
        updatedAt: schema.transactions.updatedAt,
        category: {
          id: schema.categories.id,
          name: schema.categories.name,
          type: schema.categories.type,
          color: schema.categories.color,
          icon: schema.categories.icon,
        },
        account: {
          id: schema.accounts.id,
          name: schema.accounts.name,
          type: schema.accounts.type,
        },
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .leftJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(and(
        eq(schema.transactions.workspaceId, query.workspaceId),
        isNull(schema.transactions.deletedAt)
      ))
      .orderBy(desc(schema.transactions.date))
      .limit(limit);
      
      return { success: true, data: { transactions } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Optional(t.Object({
      workspaceId: t.String(),
      limit: t.Optional(t.String()),
    })),
  })

  .get('/:id', async ({ params, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [transaction] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, params.id));
    
    if (!transaction) {
      return { error: 'Transaction not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, transaction.workspaceId, 'transactions.read');
    if (access.error) {
      return { error: access.error };
    }
    
    return { success: true, data: { transaction } };
  })

  .patch('/:id', async ({ params, body, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [transaction] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, params.id));
    
    if (!transaction) {
      return { error: 'Transaction not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, transaction.workspaceId, 'transactions.update');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const [updatedTransaction] = await db.update(schema.transactions)
        .set({
          accountId: body.accountId,
          categoryId: body.categoryId,
          amount: body.amount,
          type: body.type,
          description: body.description,
          date: body.date ? new Date(body.date) : undefined,
          notes: body.notes,
          metadata: body.metadata,
          isStaging: body.isStaging,
          updatedAt: new Date(),
        })
        .where(eq(schema.transactions.id, params.id))
        .returning();
      
      return { success: true, data: { transaction: updatedTransaction } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      accountId: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      amount: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal('income'), t.Literal('expense')])),
      description: t.Optional(t.String()),
      date: t.Optional(t.String()),
      notes: t.Optional(t.String()),
      metadata: t.Optional(t.Any()),
      isStaging: t.Optional(t.Boolean()),
    }),
  })

  .delete('/:id', async ({ params, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [transaction] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, params.id));
    
    if (!transaction) {
      return { error: 'Transaction not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, transaction.workspaceId, 'transactions.delete');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      await db.update(schema.transactions)
        .set({
          deletedAt: new Date(),
          deletedBy: auth.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.transactions.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  });
