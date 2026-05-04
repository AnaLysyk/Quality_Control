"use client";

import React from 'react';
import styles from './styles.module.css';
import { useI18n } from '@/hooks/useI18n';

type User = { id: string; name: string; email: string; role: string; companies: string[]; status: string };

export default function UsersList({ users, onSelect }: { users: User[]; onSelect: (u: User) => void }) {
  const { language } = useI18n();
  const isPt = language === 'pt-BR';
  return (
    <div className={styles.usersList}>
      <div className={styles.searchWrap}>
        <input placeholder={isPt ? 'Buscar nome ou email' : 'Search name or email'} className={styles.searchInput} />
      </div>
      <div>
        {users.map(u => (
          <div key={u.id} className={styles.userItem} onClick={() => onSelect(u)}>
            <div className={styles.userNameSmall}>{u.name}</div>
            <div className={styles.userMeta}>{u.email} — {u.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
