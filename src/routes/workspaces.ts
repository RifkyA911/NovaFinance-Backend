import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { requireAuth, requireWorkspaceAccess } from '../middleware/auth';
import { auth } from '../auth';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  s3Client,
  BUCKET_NAME,
  checkStorageQuotaGuard,
  recordUpload,
} from '../services/storage';

export const workspaceRoutes = new Elysia({ prefix: '/api/workspaces' })
  .post('', async ({ body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    try {
      const [workspace] = await db.insert(schema.workspaces).values({
        ownerId: authResult.user.id,
        name: body.name,
        type: body.type,
        currency: body.currency || 'IDR',
        customBrandLogo: body.customBrandLogo,
        customBrandName: body.customBrandName,
        customBrandDescription: body.customBrandDescription,
        customBrandJargon: body.customBrandJargon,
        customBrandMode: body.customBrandMode || 'square',
        customBrandDisplay: body.customBrandDisplay || 'logo-and-text',
        planTier: body.planTier || 'pro',
      }).returning();
      
      // Add owner as collaborator
      await db.insert(schema.collaborators).values({
        workspaceId: workspace.id,
        userId: authResult.user.id,
        role: 'owner',
        invitedBy: authResult.user.id,
      });
      
      return { success: true, data: { workspace } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      name: t.String(),
      type: t.Union([t.Literal('personal'), t.Literal('umkm'), t.Literal('pt')]),
      currency: t.Optional(t.String()),
      customBrandLogo: t.Optional(t.String()),
      customBrandName: t.Optional(t.String()),
      customBrandDescription: t.Optional(t.String()),
      customBrandJargon: t.Optional(t.String()),
      customBrandMode: t.Optional(t.Union([t.Literal('square'), t.Literal('wide')])),
      customBrandDisplay: t.Optional(t.Union([t.Literal('logo-and-text'), t.Literal('logo-only'), t.Literal('full-banner')])),
      planTier: t.Optional(t.Union([t.Literal('basic'), t.Literal('pro'), t.Literal('enterprise')])),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Create workspace',
      description: 'Create a new workspace. User becomes the owner with full permissions (owner, admin, staff, member roles).\n\n**Request Body:**\n```json\n{\n  "name": "Personal Finance",\n  "type": "personal",\n  "currency": "IDR"\n}\n```\n\n**Workspace Types:**\n- `personal`: Personal finance tracking\n- `umkm`: Small business management\n- `pt`: Corporate entity management\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspace": {\n      "id": "workspace-uuid",\n      "ownerId": "user-uuid",\n      "name": "Personal Finance",\n      "type": "personal",\n      "currency": "IDR",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('', async ({ headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    try {
      // Get workspaces where user is owner or collaborator
      const ownedWorkspaces = await db.select().from(schema.workspaces)
        .where(and(
          eq(schema.workspaces.ownerId, authResult.user.id),
          isNull(schema.workspaces.deletedAt)
        ));
      
      const collaboratorWorkspaces = await db.select({
        workspace: schema.workspaces,
        role: schema.collaborators.role,
      }).from(schema.collaborators)
        .innerJoin(schema.workspaces, eq(schema.collaborators.workspaceId, schema.workspaces.id))
        .where(and(
          eq(schema.collaborators.userId, authResult.user.id),
          isNull(schema.workspaces.deletedAt)
        ));
      
      // Deduplicate workspaces by ID (user might be both owner and collaborator)
      const workspaceMap = new Map();
      ownedWorkspaces.forEach(w => workspaceMap.set(w.id, { ...w, role: 'owner' }));
      collaboratorWorkspaces.forEach(c => {
        if (!workspaceMap.has(c.workspace.id)) {
          workspaceMap.set(c.workspace.id, { ...c.workspace, role: c.role });
        }
      });
      
      const workspaces = Array.from(workspaceMap.values());
      
      return { success: true, data: { workspaces } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'List user workspaces',
      description: 'Get all workspaces where user is owner or collaborator. Returns user role for each workspace (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspaces": [\n      {\n        "id": "workspace-uuid-1",\n        "name": "Personal Finance",\n        "type": "personal",\n        "currency": "IDR",\n        "role": "owner",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      },\n      {\n        "id": "workspace-uuid-2",\n        "name": "Business Operations",\n        "type": "umkm",\n        "currency": "IDR",\n        "role": "admin",\n        "createdAt": "2026-09-14T15:00:00.000Z"\n      }\n    ]\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .get('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    return { success: true, data: { workspace: access.workspace, role: access.role } };
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'Get workspace by ID',
      description: 'Get workspace details and user role. Requires workspace access (owner, admin, staff, member).\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspace": {\n      "id": "workspace-uuid",\n      "ownerId": "user-uuid",\n      "name": "Personal Finance",\n      "type": "personal",\n      "currency": "IDR",\n      "createdAt": "2026-09-14T15:00:00.000Z",\n      "updatedAt": "2026-09-14T15:00:00.000Z"\n    },\n    "role": "owner"\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .patch('/:id', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.currency !== undefined) {
        // Security & Ledger Integrity Audit: Check if workspace currently has recorded transactions
        const [currentWs] = await db
          .select({ currency: schema.workspaces.currency })
          .from(schema.workspaces)
          .where(eq(schema.workspaces.id, params.id))
          .limit(1);

        if (currentWs && currentWs.currency !== body.currency) {
          const [txStat] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.transactions)
            .where(
              and(
                eq(schema.transactions.workspaceId, params.id),
                isNull(schema.transactions.deletedAt)
              )
            );

          const txCount = Number(txStat?.count || 0);
          if (txCount > 0) {
            set.status = 400;
            return {
              success: false,
              error: `Mata uang tidak dapat diubah dari ${currentWs.currency} ke ${body.currency} karena entitas telah memiliki ${txCount} transaksi tercatat. Mengubah mata uang secara langsung akan mendistorsi nilai nominal historis. Buat workspace baru untuk entitas dengan mata uang berbeda.`,
              code: 'CURRENCY_MUTATION_FORBIDDEN_WITH_LEDGER',
              data: { transactionCount: txCount, currentCurrency: currentWs.currency },
            };
          }
        }
        updateData.currency = body.currency;
      }
      if (body.customBrandLogo !== undefined) updateData.customBrandLogo = body.customBrandLogo;
      if (body.customBrandName !== undefined) updateData.customBrandName = body.customBrandName;
      if (body.customBrandDescription !== undefined) updateData.customBrandDescription = body.customBrandDescription;
      if (body.customBrandJargon !== undefined) updateData.customBrandJargon = body.customBrandJargon;
      if (body.customBrandMode !== undefined) updateData.customBrandMode = body.customBrandMode;
      if (body.customBrandDisplay !== undefined) updateData.customBrandDisplay = body.customBrandDisplay;
      if (body.entityType !== undefined) updateData.entityType = body.entityType;
      if (body.taxId !== undefined) updateData.taxId = body.taxId;
      if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl;
      if (body.planTier !== undefined) updateData.planTier = body.planTier;

      const [workspace] = await db.update(schema.workspaces)
        .set(updateData)
        .where(eq(schema.workspaces.id, params.id))
        .returning();
      
      return { success: true, data: { workspace } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.Nullable(t.String())),
      type: t.Optional(t.Nullable(t.Union([t.Literal('personal'), t.Literal('umkm'), t.Literal('pt')]))),
      currency: t.Optional(t.Nullable(t.String())),
      customBrandLogo: t.Optional(t.Nullable(t.String())),
      customBrandName: t.Optional(t.Nullable(t.String())),
      customBrandDescription: t.Optional(t.Nullable(t.String())),
      customBrandJargon: t.Optional(t.Nullable(t.String())),
      customBrandMode: t.Optional(t.Nullable(t.Union([t.Literal('square'), t.Literal('wide')]))),
      customBrandDisplay: t.Optional(t.Nullable(t.Union([t.Literal('logo-and-text'), t.Literal('logo-only'), t.Literal('full-banner')]))),
      entityType: t.Optional(t.Nullable(t.String())),
      taxId: t.Optional(t.Nullable(t.String())),
      websiteUrl: t.Optional(t.Nullable(t.String())),
      planTier: t.Optional(t.Nullable(t.Union([t.Literal('basic'), t.Literal('pro'), t.Literal('enterprise')]))),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Update workspace',
      description: 'Update workspace details. Requires owner or admin role.\n\n**Request Body:**\n```json\n{\n  "name": "Personal Finance Updated",\n  "type": "personal",\n  "currency": "USD"\n}\n```\n\n**Response:**\n```json\n{\n  "success": true,\n  "data": {\n    "workspace": {\n      "id": "workspace-uuid",\n      "name": "Personal Finance Updated",\n      "type": "personal",\n      "currency": "USD",\n      "updatedAt": "2026-09-14T15:30:00.000Z"\n    }\n  }\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  .delete('/:id', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }
    
    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.delete');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }
    
    try {
      await db.update(schema.workspaces)
        .set({
          deletedAt: new Date(),
          deletedBy: authResult.user.id,
          deletedReason: 'User deletion',
          updatedAt: new Date(),
        })
        .where(eq(schema.workspaces.id, params.id));
      
      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'Delete workspace',
      description: 'Soft delete workspace (sets deletedAt timestamp). Requires owner role only. Workspace data is retained but marked as deleted.\n\n**Response:**\n```json\n{\n  "success": true\n}\n```',
      security: [{ BearerAuth: [] }],
    },
  })

  // 5. List workspace members (Collaborators & Owner)
  .get('/:id/members', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      // Get workspace owner
      const [workspace] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, params.id));
      const [ownerUser] = await db.select().from(schema.users).where(eq(schema.users.id, workspace.ownerId));

      // Get all collaborators
      const collabs = await db
        .select({
          id: schema.collaborators.id,
          userId: schema.collaborators.userId,
          role: schema.collaborators.role,
          createdAt: schema.collaborators.createdAt,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.collaborators)
        .leftJoin(schema.users, eq(schema.collaborators.userId, schema.users.id))
        .where(eq(schema.collaborators.workspaceId, params.id));

      const memberList = [];

      // Add owner first
      if (ownerUser) {
        memberList.push({
          id: `owner-${ownerUser.id}`,
          userId: ownerUser.id,
          name: `${ownerUser.name} (Owner)`,
          email: ownerUser.email,
          role: 'owner',
          status: 'active',
          twoFactorEnabled: true,
          joinedAt: workspace.createdAt.toISOString(),
          lastActive: 'Just now',
          avatarColor: 'from-amber-500 to-orange-600',
        });
      }

      for (const c of collabs) {
        if (c.userId !== workspace.ownerId) {
          memberList.push({
            id: c.id,
            userId: c.userId,
            name: c.name || c.email?.split('@')[0] || 'Team Member',
            email: c.email || 'collaborator@workspace.local',
            role: c.role,
            status: 'active',
            twoFactorEnabled: c.role === 'admin',
            joinedAt: c.createdAt.toISOString(),
            lastActive: 'Active today',
            avatarColor: c.role === 'admin' ? 'from-purple-500 to-indigo-600' : 'from-blue-500 to-cyan-600',
          });
        }
      }

      return { success: true, data: { members: memberList } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'List workspace members & collaborators',
      description: 'Get all members, collaborators, and their active RBAC roles.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 6. Invite / Add new member to workspace
  .post('/:id/members', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'collaborators.invite');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      // Check if user with this email exists
      let [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, body.email));
      if (!existingUser) {
        // Create user stub
        [existingUser] = await db.insert(schema.users).values({
          id: crypto.randomUUID(),
          name: body.name || body.email.split('@')[0],
          email: body.email,
        }).returning();
      }

      // Check if already in workspace
      const [existingCollab] = await db
        .select()
        .from(schema.collaborators)
        .where(and(eq(schema.collaborators.workspaceId, params.id), eq(schema.collaborators.userId, existingUser.id)));

      if (existingCollab) {
        set.status = 400;
        return { success: false, error: 'User is already a member of this workspace', code: 'ALREADY_MEMBER' };
      }

      const [newCollab] = await db.insert(schema.collaborators).values({
        workspaceId: params.id,
        userId: existingUser.id,
        role: body.role,
        invitedBy: authResult.user.id,
      }).returning();

      return {
        success: true,
        data: {
          member: {
            id: newCollab.id,
            userId: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            role: newCollab.role,
            status: 'invited',
            twoFactorEnabled: false,
            joinedAt: newCollab.createdAt.toISOString(),
            lastActive: 'Invited',
            avatarColor: 'from-blue-500 to-indigo-600',
          },
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      email: t.String(),
      name: t.Optional(t.String()),
      role: t.Union([t.Literal('admin'), t.Literal('staff'), t.Literal('viewer')]),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Invite collaborator to workspace',
      description: 'Send invitation or assign member to workspace with specified RBAC role.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 7. Update collaborator role
  .patch('/:id/members/:userId', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'collaborators.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      const [updated] = await db
        .update(schema.collaborators)
        .set({
          role: body.role,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.collaborators.workspaceId, params.id), eq(schema.collaborators.userId, params.userId)))
        .returning();

      return { success: true, data: { collaborator: updated } };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    body: t.Object({
      role: t.Union([t.Literal('admin'), t.Literal('staff'), t.Literal('viewer')]),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Update collaborator role',
      description: 'Modify member RBAC privilege tier.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 8. Remove collaborator from workspace
  .delete('/:id/members/:userId', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'collaborators.remove');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      await db
        .delete(schema.collaborators)
        .where(and(eq(schema.collaborators.workspaceId, params.id), eq(schema.collaborators.userId, params.userId)));

      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
    }
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'Remove collaborator from workspace',
      description: 'Revoke workspace access for a collaborator.',
      security: [{ BearerAuth: [] }],
    },
  })

  // 9. Get Master Roles & Permission Definitions
  .get('/:id/roles', async ({ params, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.read');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    const masterRoles = [
      {
        id: 'owner',
        name: 'Workspace Owner',
        type: 'system',
        badgeColor: 'amber',
        description: 'Kekuasaan penuh atas workspace, penghapusan entitas, transfer kepemilikan, dan konfigurasi billing.',
        userCount: 1,
        permissions: ['all'],
      },
      {
        id: 'admin',
        name: 'Enterprise Admin',
        type: 'system',
        badgeColor: 'purple',
        description: 'Manajemen operasional penuh, undang & atur staf, kelola rekening bank, API keys AI, dan audit log.',
        userCount: 2,
        permissions: ['transactions.*', 'accounts.*', 'goals.*', 'ai.*', 'collaborators.*', 'reports.*', 'logs.*'],
      },
      {
        id: 'staff',
        name: 'Senior Accountant / Staff',
        type: 'system',
        badgeColor: 'blue',
        description: 'Pencatatan pembukuan ganda, entri mutasi harian, scan nota AI OCR, dan unduhan laporan finansial.',
        userCount: 4,
        permissions: ['transactions.create', 'transactions.read', 'transactions.update', 'accounts.read', 'ai.ocr', 'reports.export'],
      },
      {
        id: 'viewer',
        name: 'Stakeholder / Auditor',
        type: 'system',
        badgeColor: 'emerald',
        description: 'Akses baca saja untuk investor, auditor eksternal, atau konsultan pajak tanpa hak modifikasi.',
        userCount: 1,
        permissions: ['transactions.read', 'accounts.read', 'reports.read', 'analytics.read'],
      },
      {
        id: 'treasury',
        name: 'Treasury & Liquidity Officer',
        type: 'custom',
        badgeColor: 'cyan',
        description: 'Pengawasan penempatan kas, yield deposito, plafon LPS Rp 2 Miliar, dan optimasi idle cash.',
        userCount: 1,
        permissions: ['accounts.*', 'reports.read', 'transactions.read'],
      },
    ];

    return { success: true, data: { roles: masterRoles } };
  }, {
    detail: {
      tags: ['Workspaces'],
      summary: 'Get Master Roles & Permission definitions',
      description: 'Retrieve system and custom master roles with fine-grained capability mapping.',
      security: [{ BearerAuth: [] }],
    },
  })

  // ── Brand Logo Upload to Structured MinIO Storage ──────────────────────
  .post('/:id/brand-logo', async ({ params, body, headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || 'Authentication failed', code: 'UNAUTHORIZED' };
    }

    const access = await requireWorkspaceAccess(authResult.user.id, params.id, 'workspaces.update');
    if (access.error) {
      set.status = access.status || 403;
      return { success: false, error: access.error, code: 'FORBIDDEN' };
    }

    try {
      let fileBuffer: Buffer;
      let contentType = 'image/webp';
      let extension = 'webp';

      if (body.dataUrl && typeof body.dataUrl === 'string') {
        const matches = body.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          fileBuffer = Buffer.from(matches[2], 'base64');
          if (contentType.includes('svg')) extension = 'svg';
          else if (contentType.includes('gif')) extension = 'gif';
          else if (contentType.includes('png')) extension = 'png';
          else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
          else extension = 'webp';
        } else {
          fileBuffer = Buffer.from(body.dataUrl, 'base64');
        }
      } else if (body.file && typeof body.file === 'object' && 'arrayBuffer' in body.file) {
        const fileObj = body.file as File;
        contentType = fileObj.type || 'image/webp';
        if (contentType.includes('svg')) extension = 'svg';
        else if (contentType.includes('gif') || fileObj.name?.endsWith('.gif')) extension = 'gif';
        else if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
        else extension = 'webp';
        const arr = await fileObj.arrayBuffer();
        fileBuffer = Buffer.from(arr);
      } else {
        set.status = 400;
        return { success: false, error: 'No brand image provided', code: 'VALIDATION_ERROR' };
      }

      const mode = body.mode === 'wide' ? 'wide' : 'square';
      const filename = `${mode}_${Date.now()}.${extension}`;
      // Structured MinIO Key: NovaFinance/workspaces/{workspaceId}/brand/{mode}_{timestamp}.{ext}
      const s3Key = `NovaFinance/workspaces/${params.id}/brand/${filename}`;

      // Storage Quota Guard (8GB limit for R2/MinIO)
      const quotaCheck = await checkStorageQuotaGuard(fileBuffer.length);
      if (!quotaCheck.allowed) {
        set.status = 413;
        return {
          success: false,
          error: quotaCheck.error,
          code: quotaCheck.code,
          data: { storageUsage: quotaCheck.usage },
        };
      }

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType,
          ContentLength: fileBuffer.length,
        })
      );
      recordUpload(fileBuffer.length);

      const brandLogoUrl = `http://localhost:8080/api/workspaces/brand-logo/${params.id}/${filename}`;

      const [updatedWorkspace] = await db
        .update(schema.workspaces)
        .set({
          customBrandLogo: brandLogoUrl,
          customBrandMode: mode,
          updatedAt: new Date(),
        })
        .where(eq(schema.workspaces.id, params.id))
        .returning();

      return {
        success: true,
        message: 'Brand logo uploaded to MinIO and saved successfully',
        brandLogoUrl,
        data: { workspace: updatedWorkspace },
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message || 'Failed to upload brand logo', code: 'UPLOAD_ERROR' };
    }
  }, {
    body: t.Object({
      dataUrl: t.Optional(t.String()),
      file: t.Optional(t.Any()),
      mode: t.Optional(t.Union([t.Literal('square'), t.Literal('wide')])),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Upload corporate brand logo to MinIO S3',
      description: 'Uploads square or wide brand logo into structured MinIO folder NovaFinance/workspaces/{workspaceId}/brand/ and updates workspace settings.',
      security: [{ BearerAuth: [] }],
    },
  })

  // ── Serve Brand Logo from MinIO S3 ─────────────────────────────────────
  .get('/brand-logo/:workspaceId/:filename', async ({ params, set }) => {
    try {
      const primaryKey = `NovaFinance/workspaces/${params.workspaceId}/brand/${params.filename}`;
      const fallbackKey = `workspaces/${params.workspaceId}/brand/${params.filename}`;

      let response;
      try {
        response = await s3Client.send(new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: primaryKey,
        }));
      } catch {
        response = await s3Client.send(new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fallbackKey,
        }));
      }
      const contentType = response.ContentType || 'image/webp';

      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          const chunks: any[] = [];
          stream.on('data', (chunk: any) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
      };

      if (response.Body) {
        const buf = await streamToBuffer(response.Body);
        return new Response(new Uint8Array(buf), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }

      set.status = 404;
      return { success: false, error: 'Brand logo not found' };
    } catch {
      set.status = 404;
      return { success: false, error: 'Brand logo not found in storage' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String(),
      filename: t.String(),
    }),
    detail: {
      tags: ['Workspaces'],
      summary: 'Serve workspace corporate brand logo from MinIO S3',
      description: 'Stream workspace brand logo from structured MinIO folder.',
    },
  });

