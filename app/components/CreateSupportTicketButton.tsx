"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { useEffect } from "react";

export default function CreateSupportTicketButton() {
  const { user, can } = usePermissionAccess();
  const { activeClientSlug, activeClientId } = useClientContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
  });
  const [devs, setDevs] = useState<Array<{ id: string; name: string }>>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const bodyPayload: any = {
        title: form.title.trim(),
        description: form.description.trim(),
        companySlug: activeClientSlug ?? (user as any)?.company?.slug ?? "test-company",
        companyId: activeClientId ?? (user as any)?.company?.id ?? (user as any)?.companyId ?? null,
      };
      if (assignedTo) bodyPayload.assignedToUserId = assignedTo;

      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Erro ao criar chamado");
      }
      setOpen(false);
      setForm({ title: "", description: "" });
      setSaving(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar chamado");
      setSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadDevs() {
      if (!open) return;
      try {
        const companyId = activeClientId ?? (user as any)?.company?.id ?? (user as any)?.companyId ?? null;
        if (!companyId) return;
        const res = await fetch(`/api/users?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const users = await res.json().catch(() => []);
        if (!mounted) return;
        const devs = Array.isArray(users) ? users.filter((u: any) => {
          const role = (u.role ?? "").toString().toLowerCase();
          return role === "dev" || role === "it_dev" || role === "itdev" || role === "developer";
        }).map((u: any) => ({ id: u.id, name: u.name || u.email || u.id })) : [];
        setDevs(devs);
      } catch {
        // ignore
      }
    }
    loadDevs();
    return () => { mounted = false; };
  }, [open]);

  if (!user) return null;
  if (!can("support", "create") || !can("support", "modal")) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-(--tc-accent) px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110"
      >
        Criar chamado de suporte
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-(--tc-border)/30 bg-white text-(--tc-text,#0f172a) shadow-[0_25px_80px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-(--tc-surface-dark,#0f1828) dark:text-(--tc-text-inverse,#fff) p-6">
            <h2 className="text-lg font-bold mb-4">Novo chamado de suporte</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-(--tc-text-muted)">Título</label>
                <input
                  className="w-full rounded-xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface-darker,#0c1220) dark:text-(--tc-text-inverse,#fff)"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Título do chamado"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-(--tc-text-muted)">Descrição</label>
                <textarea
                  className="w-full rounded-xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface-darker,#0c1220) dark:text-(--tc-text-inverse,#fff)"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o problema ou solicitação"
                />
              </div>
              {devs.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-(--tc-text-muted)">Atribuir a (dev)</label>
                  <select
                    id="create-support-assignee"
                    aria-label="Atribuir a (dev)"
                    className="w-full rounded-xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent)"
                    value={assignedTo ?? ""}
                    onChange={(e) => setAssignedTo(e.target.value || null)}
                  >
                    <option value="">-- nenhum --</option>
                    {devs.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-(--tc-border)/60 px-4 py-2 text-sm font-semibold text-(--tc-text,#0f172a) transition hover:border-(--tc-text-primary,#0b1a3c) hover:text-(--tc-text-primary,#0b1a3c) dark:border-white/20 dark:text-(--tc-text-inverse,#fff)"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !form.title.trim()}
                className="rounded-xl bg-(--tc-accent) px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar chamado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
