"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ManualStatsFormProps = {
  slug: string;
  initialStats: { pass: number; fail: number; blocked: number; notRun: number };
};

export function ManualStatsForm({ slug, initialStats }: ManualStatsFormProps) {
  const router = useRouter();
  const [stats, setStats] = useState(initialStats);
  const [saving, setSaving] = useState(false);

  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;

  const update = (key: keyof typeof stats, value: string) => {
    const n = Math.max(0, Number(value) || 0);
    setStats((prev) => ({ ...prev, [key]: n }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/releases-manual/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats }),
      });

      if (!res.ok) {
        throw new Error(`save_failed_${res.status}`);
      }

      router.refresh();
    } catch (e) {
      console.error("Erro ao salvar stats manuais", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-(--tc-border)/40 bg-(--tc-surface-dark,#0f1828) p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-(--tc-text-inverse)">Resultados manuais</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-(--tc-accent) px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["pass", "fail", "blocked", "notRun"] as const).map((key) => (
          <div key={key} className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-(--tc-text-muted)">{key}</label>
            <input
              type="number"
              min={0}
              aria-label={`Total ${key}`}
              value={stats[key]}
              onChange={(e) => update(key, e.target.value)}
              className="w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/40"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-(--tc-text-muted)">
        <span>Total: {total}</span>
        <span>Pass%: {total > 0 ? Math.round((stats.pass / total) * 100) : 0}%</span>
      </div>
    </div>
  );
}
