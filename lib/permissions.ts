
// Helpers para permissões baseadas em role
// Este arquivo centraliza a lógica de controle de permissões por tipo de usuário (role)

// Define os tipos de usuário possíveis na aplicação
export type UserRole = 'user' | 'admin' | 'super-admin';

// Define todas as permissões possíveis do sistema
export type Permission =
  | 'read_dashboard'        // Permite visualizar o dashboard
  | 'manage_users'          // Permite gerenciar usuários
  | 'manage_companies'      // Permite gerenciar empresas
  | 'manage_releases'       // Permite gerenciar releases
  | 'manage_tests'          // Permite gerenciar testes
  | 'view_admin'            // Permite acessar área/admin
  | 'manage_settings';      // Permite alterar configurações gerais

// Mapeia cada tipo de usuário para as permissões que ele possui
const rolePermissions: Record<UserRole, Permission[]> = {
  user: [
    'read_dashboard',
    'manage_tests',
  ],
  admin: [
    'read_dashboard',
    'manage_users',
    'manage_companies',
    'manage_releases',
    'manage_tests',
    'view_admin',
  ],
  'super-admin': [
    'read_dashboard',
    'manage_users',
    'manage_companies',
    'manage_releases',
    'manage_tests',
    'view_admin',
    'manage_settings',
  ],
};

// Função para checar se um usuário (pelo role) possui determinada permissão
// Retorna true se possuir, false caso contrário
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return rolePermissions[userRole]?.includes(permission) ?? false;
}

// Função que lança erro caso o usuário não tenha a permissão exigida
// Útil para proteger rotas ou operações críticas
export function requirePermission(userRole: UserRole, permission: Permission): void {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Permission denied: ${permission} for role ${userRole}`);
  }
}

// Função auxiliar para extrair o role do usuário a partir da sessão
// Se não encontrar, assume 'user' como padrão
export function getUserRoleFromSession(session: any): UserRole {
  const role = session?.role;
  if (role === 'admin' || role === 'super-admin') return role;
  return 'user'; // padrão
}