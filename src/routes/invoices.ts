import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const invoiceRoutes = new Elysia({ prefix: '/api/invoices' })
  .post('/', async ({ body, headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, body.workspaceId, 'invoices.create');
    if (access.error) {
      set.status = access.status || 403;
      return { error: access.error };
    }
    
    try {
      const [invoice] = await db.insert(schema.invoices).values({
        workspaceId: body.workspaceId,
        invoiceNumber: body.invoiceNumber,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        status: body.status || 'draft',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        paidDate: body.paidDate ? new Date(body.paidDate) : null,
        subtotal: body.subtotal || '0',
        tax: body.tax || '0',
        total: body.total || '0',
        items: body.items || [],
        notes: body.notes,
      }).returning();
      
      return { success: true, data: { invoice } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      invoiceNumber: t.String(),
      clientName: t.Optional(t.String()),
      clientEmail: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal('draft'), t.Literal('unpaid'), t.Literal('paid'), t.Literal('overdue'), t.Literal('cancelled')])),
      dueDate: t.Optional(t.String()),
      paidDate: t.Optional(t.String()),
      subtotal: t.Optional(t.String()),
      tax: t.Optional(t.String()),
      total: t.Optional(t.String()),
      items: t.Optional(t.Array(t.Any())),
      notes: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Invoices'],
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/', async ({ headers, query, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    if (!query.workspaceId) {
      set.status = 400;
      return { error: 'workspaceId is required' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, query.workspaceId, 'invoices.read');
    if (access.error) {
      set.status = access.status || 403;
      return { error: access.error };
    }
    
    try {
      const invoices = await db.select().from(schema.invoices)
        .where(and(
          eq(schema.invoices.workspaceId, query.workspaceId),
          isNull(schema.invoices.deletedAt)
        ));
      
      return { success: true, data: { invoices } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['Invoices'],
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, params.id));
    
    if (!invoice) {
      set.status = 404;
      return { error: 'Invoice not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, invoice.workspaceId, 'invoices.read');
    if (access.error) {
      set.status = access.status || 403;
      return { error: access.error };
    }
    
    return { success: true, data: { invoice } };
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      set.status = auth.status || 401;
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, params.id));
    
    if (!invoice) {
      set.status = 404;
      return { error: 'Invoice not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, invoice.workspaceId, 'invoices.update');
    if (access.error) {
      set.status = access.status || 403;
      return { error: access.error };
    }
    
    try {
      const [updatedInvoice] = await db.update(schema.invoices)
        .set({
          invoiceNumber: body.invoiceNumber,
          clientName: body.clientName,
          clientEmail: body.clientEmail,
          status: body.status,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          paidDate: body.paidDate ? new Date(body.paidDate) : null,
          subtotal: body.subtotal,
          tax: body.tax,
          total: body.total,
          items: body.items,
          notes: body.notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.invoices.id, params.id))
        .returning();
      
      return { success: true, data: { invoice: updatedInvoice } };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      invoiceNumber: t.Optional(t.String()),
      clientName: t.Optional(t.String()),
      clientEmail: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal('draft'), t.Literal('unpaid'), t.Literal('paid'), t.Literal('overdue'), t.Literal('cancelled')])),
      dueDate: t.Optional(t.String()),
      paidDate: t.Optional(t.String()),
      subtotal: t.Optional(t.String()),
      tax: t.Optional(t.String()),
      total: t.Optional(t.String()),
      items: t.Optional(t.Array(t.Any())),
      notes: t.Optional(t.String()),
    }),
  })

  .delete('/:id', async ({ params, headers }) => {
    const auth = await requireAuth(headers);
    if (auth.error || !auth.user) {
      return { error: auth.error || 'Authentication failed' };
    }
    
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, params.id));
    
    if (!invoice) {
      return { error: 'Invoice not found' };
    }
    
    const access = await requireWorkspaceAccess(auth.user.id, invoice.workspaceId, 'invoices.delete');
    if (access.error) {
      return { error: access.error };
    }
    
    try {
      await db.update(schema.invoices)
        .set({
          deletedAt: new Date(),
          deletedBy: auth.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.invoices.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  });
