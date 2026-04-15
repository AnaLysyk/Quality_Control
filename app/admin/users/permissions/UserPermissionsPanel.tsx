"use client";

import React, { useEffect, useState } from 'react';
import PermissionGrid from './PermissionGrid';
import styles from './styles.module.css';
import { useI18n } from '@/lib/i18n';

export default function UserPermissionsPanel({ user }: { user: any }) {
  const { language } = useI18n();
  const isPt = language === 'pt-BR';
  const [roleDefaults, setRoleDefaults] = useState<Record<string, string[]>>({});
  const [modules, setModules] = useState<any[]>([]);
  const [override, setOverride] = useState<any>({ allow: {}, deny: {} });
  const [pending, setPending] = useState(false);
  const displayName = user?.fullName || user?.full_name || user?.name || user?.email || (isPt ? 'Sem nome' : 'No name');

  useEffect(() => {
    async function load() {
      const m = await fetch('/api/admin/modules').then(r => r.json());
      setModules(m.modules || []);
      // load user permissions
      if (user) {
        const res = await fetch(`/api/admin/users/${user.id}/permissions`);
        const data = await res.json();
        setRoleDefaults(data.roleDefaults || {});
        setOverride(data.override || { allow: {}, deny: {} });
      }
    }
    load();
  }, [user]);

  if (!user) return <div className={styles.panelPlaceholder}>{isPt ? 'Selecione um usuário à esquerda.' : 'Select a user on the left.'}</div>;

  async function handleSave() {
    setPending(true);
    await fetch(`/api/admin/users/${user.id}/permissions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(override) });
    setPending(false);
    // reload
    const res = await fetch(`/api/admin/users/${user.id}/permissions`);
    const data = await res.json();
    setOverride(data.override || { allow: {}, deny: {} });
  }

  function handleChange(next: any) {
    setOverride(next);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.userName}>{displayName}</div>
          <div className={styles.userMeta}>{user.email} • {user.role}</div>
        </div>
        <div className={styles.buttons}>
          <button onClick={() => window.location.reload()}>{isPt ? 'Cancelar' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={pending}>{pending ? (isPt ? 'Salvando...' : 'Saving...') : (isPt ? 'Salvar' : 'Save')}</button>
        </div>
      </div>

      <div className={styles.contentSpacing}>
        <PermissionGrid modules={modules} roleDefaults={roleDefaults} override={override} onChange={handleChange} />
      </div>
    </div>
  );
}
