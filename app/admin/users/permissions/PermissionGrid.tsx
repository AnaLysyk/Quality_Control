"use client";

import React from 'react';
import styles from './styles.module.css';
import { useI18n } from '@/lib/i18n';

type Props = {
  modules: { id: string; label: string; actions: string[] }[];
  roleDefaults: Record<string, string[]>;
  override?: { allow?: Record<string, string[]>; deny?: Record<string, string[]> };
  onChange?: (override: any) => void;
};

export default function PermissionGrid({ modules, roleDefaults, override, onChange }: Props) {
  const { language } = useI18n();
  const isPt = language === 'pt-BR';
  const allow = override?.allow || {};
  const deny = override?.deny || {};

  function toggle(moduleId: string, action: string, value: boolean) {
    const nextAllow = { ...allow };
    const nextDeny = { ...deny };
    const roleHas = (roleDefaults[moduleId] || []).includes(action);
    if (value) {
      if (!roleHas) {
        nextAllow[moduleId] = Array.from(new Set([...(nextAllow[moduleId] || []), action]));
      } else {
        if (nextDeny[moduleId]) nextDeny[moduleId] = nextDeny[moduleId].filter(a => a !== action);
      }
    } else {
      if (roleHas) {
        nextDeny[moduleId] = Array.from(new Set([...(nextDeny[moduleId] || []), action]));
      } else {
        if (nextAllow[moduleId]) nextAllow[moduleId] = nextAllow[moduleId].filter(a => a !== action);
      }
    }
    onChange?.({ allow: nextAllow, deny: nextDeny });
  }

  return (
    <div className={styles.grid}>
      {modules.map(m => (
        <div key={m.id} className={styles.moduleRow}>
          <div className={styles.moduleTitle}>{m.label}</div>
          <div className={styles.actionsRow}>
            {m.actions.map(a => {
              const roleHas = (roleDefaults[m.id] || []).includes(a);
              const isAllowed = (allow[m.id] || []).includes(a) || (roleHas && !(deny[m.id] || []).includes(a));
              return (
                <label key={a} className={styles.actionLabel}>
                  <input type="checkbox" checked={isAllowed} onChange={e => toggle(m.id, a, e.target.checked)} />
                  <span className={styles.actionText}>{a}</span>
                  {!roleHas && (allow[m.id] || []).includes(a) ? <span className={styles.overrideAllow}>{isPt ? 'sobrescrito' : 'overridden'}</span> : null}
                  {roleHas && (deny[m.id] || []).includes(a) ? <span className={styles.overrideDeny}>{isPt ? 'sobrescrito' : 'overridden'}</span> : null}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
