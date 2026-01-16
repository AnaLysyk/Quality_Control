// Helpers para permissões baseadas em role

export type UserRole = 'user' | 'admin' | 'super-admin';

export type Permission =
  | 'read_dashboard'
  | 'manage_users'
  | 'manage_companies'
  | 'manage_releases'
  | 'manage_tests'
  | 'view_admin'
  | 'manage_settings';

const rolePermissions: Record<UserRole, Permission[]> = {
  user: ['read_dashboard', 'manage_tests'],
  admin: ['read_dashboard', 'manage_users', 'manage_companies', 'manage_releases', 'manage_tests', 'view_admin'],
  'super-admin': ['read_dashboard', 'manage_users', 'manage_companies', 'manage_releases', 'manage_tests', 'view_admin', 'manage_settings'],
};

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return rolePermissions[userRole]?.includes(permission) ?? false;
}

export function requirePermission(userRole: UserRole, permission: Permission): void {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Permission denied: ${permission} for role ${userRole}`);
  }
}

// Helper para extrair role da sessão
export function getUserRoleFromSession(session: any): UserRole {
  const role = session?.role;
  if (role === 'admin' || role === 'super-admin') return role;
  return 'user'; // default
}