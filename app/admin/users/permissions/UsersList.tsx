"use client";

import React from "react";
import styles from "./styles.module.css";
import { useI18n } from "@/hooks/useI18n";

type User = { id: string; name: string; email: string; role: string; companies: string[]; status: string };
type UsersListProps = Readonly<{ users: User[]; onSelect: (user: User) => void }>;

export default function UsersList({ users, onSelect }: UsersListProps) {
  const { language } = useI18n();
  const isPt = language === "pt-BR";

  return (
    <div className={styles.usersList}>
      <div className={styles.searchWrap}>
        <input placeholder={isPt ? "Buscar nome ou email" : "Search name or email"} className={styles.searchInput} />
      </div>
      <div>
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            className={styles.userItem}
            onClick={() => onSelect(user)}
          >
            <div className={styles.userNameSmall}>{user.name}</div>
            <div className={styles.userMeta}>{user.email} — {user.role}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
