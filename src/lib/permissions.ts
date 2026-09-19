export type Role = 'owner' | 'admin' | 'staff' | 'viewer';

export type Permission = 
  | 'workspaces.create'
  | 'workspaces.read'
  | 'workspaces.update'
  | 'workspaces.delete'
  | 'transactions.create'
  | 'transactions.read'
  | 'transactions.update'
  | 'transactions.delete'
  | 'categories.create'
  | 'categories.read'
  | 'categories.update'
  | 'categories.delete'
  | 'accounts.create'
  | 'accounts.read'
  | 'accounts.update'
  | 'accounts.delete'
  | 'invoices.create'
  | 'invoices.read'
  | 'invoices.update'
  | 'invoices.delete'
  | 'goals.create'
  | 'goals.read'
  | 'goals.update'
  | 'goals.delete'
  | 'collaborators.invite'
  | 'collaborators.remove'
  | 'collaborators.update'
  | 'menus.create'
  | 'menus.read'
  | 'menus.update'
  | 'menus.delete'
  | 'reports.read'
  | 'reports.export'
  | 'settings.read'
  | 'settings.update'
  | 'logs.read';

const rolePermissions: Record<Role, Permission[]> = {
  owner: [
    'workspaces.create',
    'workspaces.read',
    'workspaces.update',
    'workspaces.delete',
    'transactions.create',
    'transactions.read',
    'transactions.update',
    'transactions.delete',
    'categories.create',
    'categories.read',
    'categories.update',
    'categories.delete',
    'accounts.create',
    'accounts.read',
    'accounts.update',
    'accounts.delete',
    'invoices.create',
    'invoices.read',
    'invoices.update',
    'invoices.delete',
    'goals.create',
    'goals.read',
    'goals.update',
    'goals.delete',
    'collaborators.invite',
    'collaborators.remove',
    'collaborators.update',
    'menus.create',
    'menus.read',
    'menus.update',
    'menus.delete',
    'reports.read',
    'reports.export',
    'settings.read',
    'settings.update',
    'logs.read',
  ],
  admin: [
    'workspaces.read',
    'workspaces.update',
    'transactions.create',
    'transactions.read',
    'transactions.update',
    'transactions.delete',
    'categories.create',
    'categories.read',
    'categories.update',
    'categories.delete',
    'accounts.create',
    'accounts.read',
    'accounts.update',
    'accounts.delete',
    'invoices.create',
    'invoices.read',
    'invoices.update',
    'invoices.delete',
    'goals.create',
    'goals.read',
    'goals.update',
    'goals.delete',
    'collaborators.invite',
    'collaborators.remove',
    'menus.create',
    'menus.read',
    'menus.update',
    'menus.delete',
    'reports.read',
    'reports.export',
    'settings.read',
    'settings.update',
    'logs.read',
  ],
  staff: [
    'workspaces.read',
    'transactions.create',
    'transactions.read',
    'transactions.update',
    'categories.read',
    'accounts.read',
    'invoices.read',
    'invoices.update',
    'goals.create',
    'goals.read',
    'goals.update',
    'menus.read',
    'reports.read',
    'settings.read',
  ],
  viewer: [
    'workspaces.read',
    'transactions.read',
    'categories.read',
    'accounts.read',
    'invoices.read',
    'goals.read',
    'menus.read',
    'reports.read',
    'settings.read',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) || false;
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission} required for role ${role}`);
  }
}

export function getRolePermissions(role: Role): Permission[] {
  return rolePermissions[role] || [];
}
