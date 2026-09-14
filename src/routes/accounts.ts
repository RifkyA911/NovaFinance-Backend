import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const accountRoutes = new Elysia({ prefix: '/api/accounts' })
  .post('/', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, body.workspaceId, 'accounts.create');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const [account] = await db.insert(schema.accounts).values({
        workspaceId: body.workspaceId,
        name: body.name,
        type: body.type,
        balance: body.balance || '0',
        currency: body.currency || 'IDR',
        accountNumber: body.accountNumber,
        bankName: body.bankName,
      }).returning();
      
      return { success: true, data: { account } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      name: t.String(),
      type: t.Union([t.Literal('bank'), t.Literal('cash'), t.Literal('ewallet'), t.Literal('credit')]),
      balance: t.Optional(t.String()),
      currency: t.Optional(t.String()),
      accountNumber: t.Optional(t.String()),
      bankName: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Accounts'],
      summary: 'Create account',
      description: 'Create a new account in workspace. Requires owner or admin role.\n\n**Request Body:**\n```json\n{\n  "workspaceId": "workspace-uuid",\n  "name": "BCA Main",\n  "type": "bank",\n  "balance": "15000000",\n  "currency": "IDR",\n  "accountNumber": "1234567890",\n  "bankName": "BCA"\n}\n```\n\n**Account Types:**\n- `bank`: Bank account (BCA, Mandiri, BRI, etc.)\n- `cash`: Physical cash\n- `ewallet`: E-wallet (GoPay, OVO, Dana, etc.)\n- `credit`: Credit card\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "account": {\n      "id": "account-uuid",\n      "workspaceId": "workspace-uuid",\n      "name": "BCA Main",\n      "type": "bank",\n      "balance": "15000000",\n      "currency": "IDR",\n      "accountNumber": "1234567890",\n      "bankName": "BCA",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    }\n  }\n}\n```',
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
      return { success: false, error: 'workspaceId is required', code: 'VALIDATION_ERROR' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'accounts.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const accounts = await db.select().from(schema.accounts)
        .where(and(
          eq(schema.accounts.workspaceId, query.workspaceId),
          isNull(schema.accounts.deletedAt)
        ));
      
      return { success: true, data: { accounts } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['Accounts'],
      summary: 'List accounts',
      description: 'Get all accounts in workspace. Requires workspace access (owner, admin, staff, member).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "accounts": [\n      {\n        "id": "account-uuid-1",\n        "workspaceId": "workspace-uuid",\n        "name": "BCA Main",\n        "type": "bank",\n        "balance": "15000000",\n        "currency": "IDR",\n        "accountNumber": "1234567890",\n        "bankName": "BCA",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      },\n      {\n        "id": "account-uuid-2",\n        "workspaceId": "workspace-uuid",\n        "name": "GoPay",\n        "type": "ewallet",\n        "balance": "2500000",\n        "currency": "IDR",\n        "accountNumber": "08123456789",\n        "bankName": "GoPay",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, params.id));
    
    if (!account) {
      set.status = 404;
      return { success: false, error: 'Account not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, account.workspaceId, 'accounts.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    return { success: true, data: { account } };
  }, {
    detail: {
      tags: ['Accounts'],
      summary: 'Get account by ID',
      description: 'Get account details. Requires workspace access (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "account": {\n      "id": "account-uuid",\n      "workspaceId": "workspace-uuid",\n      "name": "BCA Main",\n      "type": "bank",\n      "balance": "15000000",\n      "currency": "IDR",\n      "accountNumber": "1234567890",\n      "bankName": "BCA",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, params.id));
    
    if (!account) {
      set.status = 404;
      return { success: false, error: 'Account not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, account.workspaceId, 'accounts.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const [updatedAccount] = await db.update(schema.accounts)
        .set({
          name: body.name,
          type: body.type,
          balance: body.balance,
          currency: body.currency,
          accountNumber: body.accountNumber,
          bankName: body.bankName,
          updatedAt: new Date(),
        })
        .where(eq(schema.accounts.id, params.id))
        .returning();
      
      return { success: true, data: { account: updatedAccount } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal('bank'), t.Literal('cash'), t.Literal('ewallet'), t.Literal('credit')])),
      balance: t.Optional(t.String()),
      currency: t.Optional(t.String()),
      accountNumber: t.Optional(t.String()),
      bankName: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Accounts'],
      summary: 'Update account',
      description: 'Update account details. Requires owner or admin role.\n\n**Request Body:**\n```json\n{\n  "name": "BCA Main Updated",\n  "type": "bank",\n  "balance": "20000000",\n  "currency": "IDR",\n  "accountNumber": "1234567890",\n  "bankName": "BCA"\n}\n```\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "account": {\n      "id": "account-uuid",\n      "name": "BCA Main Updated",\n      "type": "bank",\n      "balance": "20000000",\n      "currency": "IDR",\n      "updatedAt": "2026-09-14T15:30:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, params.id));
    
    if (!account) {
      set.status = 404;
      return { success: false, error: 'Account not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, account.workspaceId, 'accounts.delete');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      await db.update(schema.accounts)
        .set({
          deletedAt: new Date(),
          deletedBy: authResult.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.accounts.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Accounts'],
      summary: 'Delete account',
      description: 'Soft delete account (sets deletedAt timestamp). Requires owner or admin role. Account data is retained but marked as deleted.\n\n**Response:**\n```json\n{\n  "success": true\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  });
