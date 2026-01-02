"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAppMeta } from "@/lib/appMeta";

type NewManualRelease = {
  name: string;
  app: string;
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  observations?: string;
};

const initialState: NewManualRelease = {
  name: "",
  app: "SMART",
  pass: 0,
  fail: 0,
  blocked: 0,
  notRun: 0,
  observations: "",
};

export function CreateManualReleaseButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewManualRelease>(initialState);

  const apps = [
    "SMART",
    "PRINT",
    "BOOKING",
    "CDS",
    "TRUST",
    "CIDADAO SMART",
    "GMT",
  ];

  const total = form.pass + form.fail + form.blocked + form.notRun;
  const appMeta = getAppMeta(form.app.toLowerCase(), form.app);

  const handleNumber = (key: keyof NewManualRelease, value: string) => {
    const n = Math.max(0, Number(value) || 0);
    setForm((prev) => ({ ...prev, [key]: n }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/releases-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          app: form.app,
          stats: {
            pass: form.pass,
            fail: form.fail,
            blocked: form.blocked,
            notRun: form.notRun,
          },
          observations: form.observations,
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar release");
      const created = await res.json();
      setOpen(false);
      setForm(initialState);
      router.push(`/release/${created.slug}`);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-[var(--tc-accent)] px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110"
      >
        Criar release manual
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--tc-surface-dark,#0f1828)] text-[var(--tc-text-inverse)] border border-[var(--tc-border)]/40 shadow-xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova release manual</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-[var(--tc-text-muted)] hover:text-white"
              >
                fechar
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-[var(--tc-text-muted)]">Título</label>
                <input
                  className="w-full rounded-lg bg-[--tc-surface] border border-[var(--tc-border)] px-3 py-2 text-sm text-[--tc-text-inverse] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent)]/40"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Release 1.9.0 - Aceitacao"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[var(--tc-text-muted)]">Aplicação</label>
                <select
                  className="w-full rounded-lg bg-[--tc-surface] border border-[var(--tc-border)] px-3 py-2 text-sm text-[--tc-text-inverse]"
                  value={form.app}
                  onChange={(e) => setForm((prev) => ({ ...prev, app: e.target.value }))}
                >
                  {apps.map((app) => (
                    <option key={app} value={app}>
                      {app}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-[var(--tc-text-muted)]">
                  {appMeta.label} • cor aplicada automaticamente
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(["pass", "fail", "blocked", "notRun"] as const).map((key) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-[var(--tc-text-muted)]">{key}</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-lg bg-[--tc-surface] border border-[var(--tc-border)] px-3 py-2 text-sm text-[--tc-text-inverse] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent)]/40"
                      value={form[key]}
                      onChange={(e) => handleNumber(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--tc-text-muted)]">
                <span>Total: {total}</span>
                <span>
                  Pass%: {total > 0 ? Math.round((form.pass / total) * 100) : 0}%
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[var(--tc-text-muted)]">Observações</label>
                <textarea
                  className="w-full rounded-lg bg-[--tc-surface] border border-[var(--tc-border)] px-3 py-2 text-sm text-[--tc-text-inverse] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent)]/40"
                  rows={3}
                  value={form.observations}
                  onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))}
                  placeholder="Notas sobre a release..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[var(--tc-border)] px-4 py-2 text-sm text-[var(--tc-text-inverse)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !form.name.trim()}
                className="rounded-lg bg-[var(--tc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar e abrir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
