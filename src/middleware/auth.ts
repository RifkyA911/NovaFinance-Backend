import { auth } from '../auth';
import { eq, and } from 'drizzle-orm';
import { db } from '../auth/config';
import * as schema from '../db/schema';
import * as authSchema from '../db/auth-schema';

export async function requireAuth(headers: any) {
  const session = await auth.api.getSession({
    headers: headers,
  });

  if (!session) {
    console.log('Auth failed: Invalid session');
    return { error: 'Invalid or expired session', status: 401 };
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

export async function requireWorkspaceAccess(userId: string, workspaceId: string, permission?: any) {
  const result = await getWorkspaceRole(userId, workspaceId);
  
  if (result.error) {
    return { error: result.error, status: 403 };
  }
  
  return { role: result.role, workspace: result.workspace };
}
