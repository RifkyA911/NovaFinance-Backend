import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';

export const invoiceRoutes = new Elysia({ prefix: '/api/invoices' })
  .post('/', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, body.workspaceId, 'invoices.create');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
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
      summary: 'Create invoice',
      description: 'Create a new invoice in workspace. Requires owner, admin, or staff role.\n\n**Request Body:**\n```json\n{\n  "workspaceId": "workspace-uuid",\n  "invoiceNumber": "INV-2024-001",\n  "clientName": "PT Teknologi Maju",\n  "clientEmail": "finance@teknologimaju.com",\n  "status": "unpaid",\n  "dueDate": "2026-09-28T00:00:00.000Z",\n  "subtotal": "15000000",\n  "tax": "1500000",\n  "total": "16500000",\n  "items": [\n    {\n      "description": "Web Development Services",\n      "quantity": 1,\n      "price": "15000000"\n    }\n  ],\n  "notes": "Payment received via transfer"\n}\n```\n\n**Invoice Status:**\n- `draft`: Invoice is being prepared\n- `unpaid`: Invoice sent but not paid\n- `paid`: Invoice has been paid\n- `overdue`: Invoice payment is past due date\n- `cancelled`: Invoice has been cancelled\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "invoice": {\n      "id": "invoice-uuid",\n      "workspaceId": "workspace-uuid",\n      "invoiceNumber": "INV-2024-001",\n      "clientName": "PT Teknologi Maju",\n      "clientEmail": "finance@teknologimaju.com",\n      "status": "unpaid",\n      "dueDate": "2026-09-28T00:00:00.000Z",\n      "subtotal": "15000000",\n      "tax": "1500000",\n      "total": "16500000",\n      "items": [\n        {\n          "description": "Web Development Services",\n          "quantity": 1,\n          "price": "15000000"\n        }\n      ],\n      "notes": "Payment received via transfer",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    }\n  }\n}\n```',
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
    
    const access = await requireWorkspaceAccess(authResult.user.id, query.workspaceId, 'invoices.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const invoices = await db.select().from(schema.invoices)
        .where(and(
          eq(schema.invoices.workspaceId, query.workspaceId),
          isNull(schema.invoices.deletedAt)
        ));
      
      return { success: true, data: { invoices } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['Invoices'],
      summary: 'List invoices',
      description: 'Get all invoices in workspace. Requires workspace access (owner, admin, staff, member).\n\n**Query Parameters:**\n- `workspaceId` (required): Workspace UUID\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "invoices": [\n      {\n        "id": "invoice-uuid-1",\n        "workspaceId": "workspace-uuid",\n        "invoiceNumber": "INV-2024-001",\n        "clientName": "PT Teknologi Maju",\n        "clientEmail": "finance@teknologimaju.com",\n        "status": "paid",\n        "subtotal": "15000000",\n        "tax": "1500000",\n        "total": "16500000",\n        "dueDate": "2026-09-28T00:00:00.000Z",\n        "paidDate": "2026-09-20T10:00:00.000Z",\n        "items": [\n          {\n            "description": "Web Development Services",\n            "quantity": 1,\n            "price": "15000000"\n          }\n        ],\n        "notes": "Payment received via transfer",\n        "createdAt": "2026-09-14T15:00:00.000Z",\n        "updatedAt": "2026-09-20T10:00:00.000Z"\n      },\n      {\n        "id": "invoice-uuid-2",\n        "workspaceId": "workspace-uuid",\n        "invoiceNumber": "INV-2024-002",\n        "clientName": "CV Kreatif Digital",\n        "clientEmail": "billing@kreatifdigital.com",\n        "status": "unpaid",\n        "subtotal": "8000000",\n        "tax": "800000",\n        "total": "8800000",\n        "dueDate": "2026-09-28T00:00:00.000Z",\n        "items": [\n          {\n            "description": "UI/UX Design",\n            "quantity": 1,\n            "price": "5000000"\n          },\n          {\n            "description": "Mobile App Design",\n            "quantity": 1,\n            "price": "3000000"\n          }\n        ],\n        "notes": "Payment due within 14 days",\n        "createdAt": "2026-09-14T15:00:00.000Z",\n        "updatedAt": "2026-09-14T15:00:00.000Z"\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, params.id));
    
    if (!invoice) {
      set.status = 404;
      return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, invoice.workspaceId, 'invoices.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    return { success: true, data: { invoice } };
  }, {
    detail: {
      tags: ['Invoices'],
      summary: 'Get invoice by ID',
      description: 'Get invoice details by ID. Requires workspace access (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "invoice": {\n      "id": "invoice-uuid",\n      "workspaceId": "workspace-uuid",\n      "invoiceNumber": "INV-2024-001",\n      "clientName": "PT Teknologi Maju",\n      "clientEmail": "finance@teknologimaju.com",\n      "status": "paid",\n      "subtotal": "15000000",\n      "tax": "1500000",\n      "total": "16500000",\n      "dueDate": "2026-09-28T00:00:00.000Z",\n      "paidDate": "2026-09-20T10:00:00.000Z",\n      "items": [\n        {\n          "description": "Web Development Services",\n          "quantity": 1,\n          "price": "15000000"\n        }\n      ],\n      "notes": "Payment received via transfer",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-20T10:00:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, params.id));
    
    if (!invoice) {
      set.status = 404;
      return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, invoice.workspaceId, 'invoices.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
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
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
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
    detail: {
      tags: ['Invoices'],
      summary: 'Update invoice',
      description: 'Update invoice details. Requires owner, admin, or staff role.\n\n**Request Body:**\n```json\n{\n  "invoiceNumber": "INV-2024-001-UPDATED",\n  "clientName": "PT Teknologi Maju Updated",\n  "clientEmail": "finance@teknologimaju.com",\n  "status": "paid",\n  "dueDate": "2026-09-28T00:00:00.000Z",\n  "paidDate": "2026-09-20T10:00:00.000Z",\n  "subtotal": "15000000",\n  "tax": "1500000",\n  "total": "16500000",\n  "items": [\n    {\n      "description": "Web Development Services",\n      "quantity": 1,\n      "price": "15000000"\n    }\n  ],\n  "notes": "Updated notes"\n}\n```\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "invoice": {\n      "id": "invoice-uuid",\n      "invoiceNumber": "INV-2024-001-UPDATED",\n      "clientName": "PT Teknologi Maju Updated",\n      "status": "paid",\n      "notes": "Updated notes",\n      "updatedAt": "2026-09-14T15:30:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, params.id));
    
    if (!invoice) {
      set.status = 404;
      return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, invoice.workspaceId, 'invoices.delete');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      await db.update(schema.invoices)
        .set({
          deletedAt: new Date(),
          deletedBy: authResult.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.invoices.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Invoices'],
      summary: 'Delete invoice',
      description: 'Soft delete invoice (sets deletedAt timestamp). Requires owner, admin, or staff role. Invoice data is retained but marked as deleted.\n\n**Response:**\n```json\n{\n  "success": true\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  });
