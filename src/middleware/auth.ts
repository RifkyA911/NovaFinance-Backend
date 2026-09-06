import { getSession } from '../auth/config';
import { eq, or, and } from 'drizzle-orm';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import { hasPermission, requirePermission } from '../lib/permissions';
import type { Permission } from '../lib/permissions';

export async function requireAuth(headers: any) {
  const authHeader = headers['authorization'];
  const cookieHeader = headers['cookie'];
  
  let token = '';
  
  if (authHeader) {
    token = authHeader.replace('Bearer ', '');
  } else if (cookieHeader) {
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }
  
  if (!token) {
    console.log('Auth failed: No token found. Headers:', { authHeader: !!authHeader, cookieHeader: !!cookieHeader });
    return { error: 'No authorization header or session cookie provided' };
  }
  
  const session = await getSession(token);
  
  if (!session) {
    console.log('Auth failed: Invalid session token');
    return { error: 'Invalid or expired session' };
  }
  
  return { user: session.user };
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

export async function requireWorkspaceAccess(userId: string, workspaceId: string, permission?: Permission) {
  const result = await getWorkspaceRole(userId, workspaceId);
  
  if (result.error) {
    return { error: result.error };
  }
  
  if (permission) {
    try {
      requirePermission(result.role, permission);
    } catch (error: any) {
      return { error: error.message };
    }
  }
  
  return { role: result.role, workspace: result.workspace };
}
