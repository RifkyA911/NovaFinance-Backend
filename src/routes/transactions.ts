import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const transactionRoutes = new Elysia({ prefix: '/api/transactions' })
  .post('', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, body.workspaceId, 'transactions.create');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const transaction = await db.transaction(async (tx) => {
        // Insert transaction
        const [newTx] = await tx.insert(schema.transactions).values({
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

        // Update account balance
        const [account] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, body.accountId));
        if (account) {
          const currentBalance = parseFloat(account.balance);
          const txAmount = parseFloat(body.amount);
          const newBalance = body.type === 'income' ? currentBalance + txAmount : currentBalance - txAmount;
          await tx.update(schema.accounts)
            .set({ balance: String(newBalance), updatedAt: new Date() })
            .where(eq(schema.accounts.id, body.accountId));
        }
        
        return newTx;
      });
      
      return { success: true, data: { transaction } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
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
    detail: {
      tags: ['Transactions'],
      summary: 'Create transaction',
      description: 'Create a new transaction in workspace. Requires owner, admin, or staff role.',
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
      return { success: false, error: 'workspaceId query parameter is required', code: 'VALIDATION_ERROR' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'transactions.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const limit = query.limit ? Math.min(parseInt(query.limit), 1000) : 50;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const sortBy = query.sortBy || 'date';
      const order = query.order === 'asc' ? 'asc' : 'desc';

      const sortColumn = sortBy === 'createdAt'
        ? schema.transactions.createdAt
        : sortBy === 'amount'
        ? schema.transactions.amount
        : schema.transactions.date;

      const orderClause = order === 'asc' ? asc(sortColumn) : desc(sortColumn);

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
      .orderBy(orderClause, desc(schema.transactions.createdAt))
      .limit(limit)
      .offset(offset);
      
      return { success: true, data: { transactions, total: transactions.length } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Optional(t.Object({
      workspaceId: t.String(),
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
      sortBy: t.Optional(t.String()),
      order: t.Optional(t.String()),
    })),
    detail: {
      tags: ['Transactions'],
      summary: 'List transactions',
      description: 'Get all transactions in workspace with category and account details.',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [transaction] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, params.id));
    
    if (!transaction) {
      set.status = 404;
      return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, transaction.workspaceId, 'transactions.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    return { success: true, data: { transaction } };
  }, {
    detail: {
      tags: ['Transactions'],
      summary: 'Get transaction by ID',
      description: 'Get transaction details by ID.',
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [transaction] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, params.id));
    
    if (!transaction) {
      set.status = 404;
      return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, transaction.workspaceId, 'transactions.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const updatedTransaction = await db.transaction(async (tx) => {
        // Revert old transaction amount from account
        const [oldAccount] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, transaction.accountId));
        if (oldAccount) {
          const oldBalance = parseFloat(oldAccount.balance);
          const oldTxAmount = parseFloat(transaction.amount);
          const revertedBalance = transaction.type === 'income' ? oldBalance - oldTxAmount : oldBalance + oldTxAmount;
          await tx.update(schema.accounts).set({ balance: String(revertedBalance) }).where(eq(schema.accounts.id, transaction.accountId));
        }

        // Apply new updates
        const [updatedTx] = await tx.update(schema.transactions)
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

        // Apply new transaction amount to new/same account
        const [newAccount] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, updatedTx.accountId));
        if (newAccount) {
          const currentBalance = parseFloat(newAccount.balance);
          const newTxAmount = parseFloat(updatedTx.amount);
          const newBalance = updatedTx.type === 'income' ? currentBalance + newTxAmount : currentBalance - newTxAmount;
          await tx.update(schema.accounts).set({ balance: String(newBalance) }).where(eq(schema.accounts.id, updatedTx.accountId));
        }

        return updatedTx;
      });
      
      return { success: true, data: { transaction: updatedTransaction } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
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
    detail: {
      tags: ['Transactions'],
      summary: 'Update transaction',
      description: 'Update transaction details.',
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [transaction] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, params.id));
    
    if (!transaction) {
      set.status = 404;
      return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, transaction.workspaceId, 'transactions.delete');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      await db.transaction(async (tx) => {
        // Soft delete transaction
        await tx.update(schema.transactions)
          .set({
            deletedAt: new Date(),
            deletedBy: authResult.user.id,
            deletedReason: 'User deletion',
            updatedAt: new Date(),
          })
          .where(eq(schema.transactions.id, params.id));
        
        // Revert balance
        const [account] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, transaction.accountId));
        if (account) {
          const currentBalance = parseFloat(account.balance);
          const txAmount = parseFloat(transaction.amount);
          const newBalance = transaction.type === 'income' ? currentBalance - txAmount : currentBalance + txAmount;
          await tx.update(schema.accounts).set({ balance: String(newBalance) }).where(eq(schema.accounts.id, transaction.accountId));
        }
      });
      
      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Transactions'],
      summary: 'Delete transaction',
      description: 'Soft delete transaction (sets deletedAt timestamp). Requires owner, admin, or staff role. Transaction data is retained but marked as deleted.\n\n**Response:**\n```json\n{\n  "success": true\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  });
