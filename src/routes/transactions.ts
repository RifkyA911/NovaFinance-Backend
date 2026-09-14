import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const transactionRoutes = new Elysia({ prefix: '/api/transactions' })
  .post('/', async ({ body, headers, set }) => {
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
      description: 'Create a new transaction in workspace. Requires owner, admin, or staff role.\n\n**Request Body:**\n```json\n{\n  "workspaceId": "workspace-uuid",\n  "accountId": "account-uuid",\n  "categoryId": "category-uuid",\n  "amount": "75000",\n  "type": "expense",\n  "description": "Lunch at Restaurant",\n  "date": "2026-09-14T12:00:00.000Z",\n  "notes": "Business lunch with client",\n  "metadata": {\n    "location": "Jakarta",\n    "tags": ["business", "client"]\n  },\n  "isStaging": false\n}\n```\n\n**Transaction Types:**\n- `income`: Money received (salary, freelance, investment)\n- `expense`: Money spent (food, transportation, utilities)\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "transaction": {\n      "id": "transaction-uuid",\n      "workspaceId": "workspace-uuid",\n      "accountId": "account-uuid",\n      "categoryId": "category-uuid",\n      "amount": "75000",\n      "type": "expense",\n      "description": "Lunch at Restaurant",\n      "date": "2026-09-14T12:00:00.000Z",\n      "notes": "Business lunch with client",\n      "metadata": {\n        "location": "Jakarta",\n        "tags": ["business", "client"]\n      },\n      "isStaging": false,\n      "createdAt": "2026-09-14T12:00:00.000Z",\n      "updatedAt": "2026-09-14T12:00:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/', async ({ headers, query, set }) => {
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Optional(t.Object({
      workspaceId: t.String(),
      limit: t.Optional(t.String()),
    })),
    detail: {
      tags: ['Transactions'],
      summary: 'List transactions',
      description: 'Get all transactions in workspace with category and account details. Requires workspace access (owner, admin, staff, member). Results are ordered by date (newest first).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n- `limit` (optional): Maximum number of transactions to return (default: 50)\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "transactions": [\n      {\n        "id": "transaction-uuid-1",\n        "workspaceId": "workspace-uuid",\n        "accountId": "account-uuid-1",\n        "categoryId": "category-uuid-1",\n        "amount": "75000",\n        "type": "expense",\n        "description": "Lunch at Restaurant",\n        "date": "2026-09-14T12:00:00.000Z",\n        "notes": "Business lunch with client",\n        "metadata": {\n          "location": "Jakarta"\n        },\n        "isStaging": false,\n        "createdAt": "2026-09-14T12:00:00.000Z",\n        "updatedAt": "2026-09-14T12:00:00.000Z",\n        "category": {\n          "id": "category-uuid-1",\n          "name": "Food & Dining",\n          "type": "expense",\n          "color": "#EF4444",\n          "icon": "🍔"\n        },\n        "account": {\n          "id": "account-uuid-1",\n          "name": "BCA Main",\n          "type": "bank"\n        }\n      },\n      {\n        "id": "transaction-uuid-2",\n        "workspaceId": "workspace-uuid",\n        "accountId": "account-uuid-2",\n        "categoryId": "category-uuid-2",\n        "amount": "15000000",\n        "type": "income",\n        "description": "Monthly Salary",\n        "date": "2026-09-01T00:00:00.000Z",\n        "notes": "September salary",\n        "category": {\n          "id": "category-uuid-2",\n          "name": "Salary",\n          "type": "income",\n          "color": "#10B981",\n          "icon": "💰"\n        },\n        "account": {\n          "id": "account-uuid-2",\n          "name": "BCA Main",\n          "type": "bank"\n        }\n      }\n    ]\n  }\n}\n```',
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
      description: 'Get transaction details by ID. Requires workspace access (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "transaction": {\n      "id": "transaction-uuid",\n      "workspaceId": "workspace-uuid",\n      "accountId": "account-uuid",\n      "categoryId": "category-uuid",\n      "amount": "75000",\n      "type": "expense",\n      "description": "Lunch at Restaurant",\n      "date": "2026-09-14T12:00:00.000Z",\n      "notes": "Business lunch with client",\n      "metadata": {\n        "location": "Jakarta",\n        "tags": ["business", "client"]\n      },\n      "isStaging": false,\n      "createdAt": "2026-09-14T12:00:00.000Z",\n      "updatedAt": "2026-09-14T12:00:00.000Z"\n    }\n  }\n}\n```',
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
      description: 'Update transaction details. Requires owner, admin, or staff role.\n\n**Request Body:**\n```json\n{\n  "accountId": "account-uuid",\n  "categoryId": "category-uuid",\n  "amount": "100000",\n  "type": "expense",\n  "description": "Lunch at Restaurant Updated",\n  "date": "2026-09-14T12:00:00.000Z",\n  "notes": "Updated notes",\n  "metadata": {\n    "location": "Jakarta",\n    "tags": ["business", "client", "updated"]\n  },\n  "isStaging": false\n}\n```\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "transaction": {\n      "id": "transaction-uuid",\n      "amount": "100000",\n      "description": "Lunch at Restaurant Updated",\n      "notes": "Updated notes",\n      "updatedAt": "2026-09-14T15:30:00.000Z"\n    }\n  }\n}\n```',
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
      await db.update(schema.transactions)
        .set({
          deletedAt: new Date(),
          deletedBy: authResult.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.transactions.id, params.id));
      
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
