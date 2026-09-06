import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';

export const accountRoutes = new Elysia({ prefix: '/api/accounts' })
  .post('/', async ({ body, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, body.workspaceId, 'accounts.create');
    if (access.error) {
      return { error: access.error };
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
      return { error: error.message };
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
  })

  .get('/', async ({ headers, query }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      return { error: 'workspaceId is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'accounts.read');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      const accounts = await db.select().from(schema.accounts)
        .where(and(
          eq(schema.accounts.workspaceId, query.workspaceId),
          isNull(schema.accounts.deletedAt)
        ));
      
      return { success: true, data: { accounts } };
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
    
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, params.id));
    
    if (!account) {
      return { error: 'Account not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, account.workspaceId, 'accounts.read');
    if (access.error) {
      return { error: access.error };
    }
    
    return { success: true, data: { account } };
  })

  .patch('/:id', async ({ params, body, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, params.id));
    
    if (!account) {
      return { error: 'Account not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, account.workspaceId, 'accounts.update');
    if (access.error) {
      return { error: access.error };
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
      return { error: error.message };
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
  })

  .delete('/:id', async ({ params, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, params.id));
    
    if (!account) {
      return { error: 'Account not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, account.workspaceId, 'accounts.delete');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      await db.update(schema.accounts)
        .set({
          deletedAt: new Date(),
          deletedBy: auth.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.accounts.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  });
