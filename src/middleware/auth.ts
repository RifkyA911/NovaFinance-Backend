import { auth } from '../auth';
import { eq, and } from 'drizzle-orm';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import * as authSchema from '../db/auth-schema';

export async function requireAuth(headers: any) {
  try {
    const session = await auth.api.getSession({
      headers: headers,
    });

    if (!session || !session.user) {
      console.log('Auth failed: Invalid or expired session');
      return { error: 'Invalid or expired session', status: 401 };
    }

    return { user: session.user };
  } catch (error) {
    console.error('Auth error:', error);
    return { error: 'Authentication failed', status: 401 };
  }
}

export async function getWorkspaceRole(userId: string, workspaceId: string) {
  // Check if user is the owner
  const [workspace] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
  
  if (!workspace) {
    return { error: 'Workspace not found' };
  }
  
  if (workspace.ownerId === userId) {
    return { role: 'owner' as const, workspace };
  }
  
  // Check if user is a collaborator
  const [collaborator] = await db.select().from(schema.collaborators).where(
    and(
      eq(schema.collaborators.workspaceId, workspaceId),
      eq(schema.collaborators.userId, userId)
    )
  );
  
  if (collaborator) {
    return { role: collaborator.role as any, workspace };
  }
  
  return { error: 'Access denied' };
}

import { hasPermission, type Role, type Permission } from '../lib/permissions';

export async function requireWorkspaceAccess(userId: string, workspaceId: string, permission?: Permission) {
  const result = await getWorkspaceRole(userId, workspaceId);
  
  if (result.error || !result.role) {
    return { error: result.error || 'Access denied', status: 403 };
  }

  // Strictly enforce RBAC permission when requested
  if (permission && !hasPermission(result.role as Role, permission)) {
    return {
      error: `Permission denied: '${permission}' privilege is required for role '${result.role}'.`,
      status: 403,
    };
  }
  
  return { role: result.role, workspace: result.workspace };
}
