"use client";

import React, { useEffect, useState } from 'react';
import UsersList from './UsersList';
import UserPermissionsPanel from './UserPermissionsPanel';
import styles from './styles.module.css';

export default function PermissionsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data.users || []);
    }
    load();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.leftCol}>
        <UsersList users={users} onSelect={u => setSelected(u)} />
      </div>
      <div className={styles.rightCol}>
        <UserPermissionsPanel user={selected} />
      </div>
    </div>
  );
}
