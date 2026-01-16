import { hasPermission, requirePermission, getUserRoleFromSession } from '@/lib/permissions';

describe('Permissions', () => {
  describe('hasPermission', () => {
    it('user can read_dashboard', () => {
      expect(hasPermission('user', 'read_dashboard')).toBe(true);
    });

    it('user cannot manage_users', () => {
      expect(hasPermission('user', 'manage_users')).toBe(false);
    });

    it('admin can manage_users', () => {
      expect(hasPermission('admin', 'manage_users')).toBe(true);
    });

    it('super-admin can manage_settings', () => {
      expect(hasPermission('super-admin', 'manage_settings')).toBe(true);
    });
  });

  describe('requirePermission', () => {
    it('throws if no permission', () => {
      expect(() => requirePermission('user', 'manage_users')).toThrow('Permission denied: manage_users for role user');
    });

    it('does not throw if has permission', () => {
      expect(() => requirePermission('admin', 'manage_users')).not.toThrow();
    });
  });

  describe('getUserRoleFromSession', () => {
    it('returns admin if session role is admin', () => {
      const session = { role: 'admin' };
      expect(getUserRoleFromSession(session)).toBe('admin');
    });

    it('returns user if session role is unknown', () => {
      const session = { role: 'unknown' };
      expect(getUserRoleFromSession(session)).toBe('user');
    });

    it('returns user if no role', () => {
      const session = {};
      expect(getUserRoleFromSession(session)).toBe('user');
    });
  });
});