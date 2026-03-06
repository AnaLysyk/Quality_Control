"use client";

import React, { useEffect, useState } from 'react';
import MODULES from '../../../src/lib/modules';

export default function PermissionsGrid({ userId, role }: { userId: string, role?: string }) {
  const [overrides, setOverrides] = useState<any>({ allow: {}, deny: {} });

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/users/${userId}/permissions`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.item) setOverrides(json.item);
    }
    load();
  }, [userId]);

  function isChecked(moduleKey: string, action: string) {
    const a = overrides.allow?.[moduleKey] || [];
    const d = overrides.deny?.[moduleKey] || [];
    if (a.includes(action)) return true;
    if (d.includes(action)) return false;
    // fallback: assume role defaults grant permission; UI will reflect overrides only
    return false;
  }

  async function toggle(moduleKey: string, action: string, checked: boolean) {
    const allow = { ...(overrides.allow || {}) };
    const deny = { ...(overrides.deny || {}) };
    if (checked) {
      if (deny[moduleKey]) deny[moduleKey] = deny[moduleKey].filter((a: string) => a !== action);
      allow[moduleKey] = Array.from(new Set([...(allow[moduleKey] || []), action]));
    } else {
      if (allow[moduleKey]) allow[moduleKey] = allow[moduleKey].filter((a: string) => a !== action);
      deny[moduleKey] = Array.from(new Set([...(deny[moduleKey] || []), action]));
    }
    const payload = { allow, deny };
    const res = await fetch(`/api/admin/users/${userId}/permissions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      const j = await res.json().catch(()=>null);
      setOverrides(j?.item || payload);
    }
  }

  return (
    <div className="space-y-4">
      {MODULES.map((m) => (
        <div key={m.key} className="border rounded p-2">
          <div className="font-medium">{m.label}</div>
          <div className="flex gap-3 mt-2 flex-wrap">
            {m.actions.map((act) => (
              <label key={act} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={isChecked(m.key, act)} onChange={(e)=>toggle(m.key, act, e.target.checked)} />
                <span className="text-sm">{act}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
