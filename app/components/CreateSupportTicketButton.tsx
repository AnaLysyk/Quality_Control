"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

type CreateSupportTicketButtonProps = {
  hiddenTrigger?: boolean;
};

export const OPEN_SUPPORT_TICKET_MODAL_EVENT = "qc:open-support-ticket-modal";

export default function CreateSupportTicketButton({ hiddenTrigger = false }: CreateSupportTicketButtonProps) {
  const { user, can, normalizedUser } = usePermissionAccess();
  const { activeClientSlug, activeClientId } = useClientContext();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const [supportOperators, setSupportOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  const canOpenCreateTicket = Boolean(user) && can("support", "create") && can("support", "modal");

  const refreshInBackground = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const bodyPayload: any = {
        title: form.title.trim(),
        description: form.description.trim(),
        companySlug: activeClientSlug ?? normalizedUser.primaryCompanySlug ?? normalizedUser.defaultCompanySlug ?? null,
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
      setAssignedTo(null);
      setSaving(false);
      refreshInBackground();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar chamado");
      setSaving(false);
    }
  };

  useEffect(() => {
    function openFromMenu() {
      if (!canOpenCreateTicket) return;
      setOpen(true);
    }

    window.addEventListener(OPEN_SUPPORT_TICKET_MODAL_EVENT, openFromMenu);
    return () => window.removeEventListener(OPEN_SUPPORT_TICKET_MODAL_EVENT, openFromMenu);
  }, [canOpenCreateTicket]);

  useEffect(() => {
    let mounted = true;
    async function loadSupportOperators() {
      if (!open) return;
      try {
        const companyId = activeClientId ?? (user as any)?.company?.id ?? (user as any)?.companyId ?? null;
        if (!companyId) return;
        const res = await fetch(`/api/users?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const users = await res.json().catch(() => []);
        if (!mounted) return;
        const operators = Array.isArray(users) ? users.filter((u: any) => {
          const role = normalizeLegacyRole(u.role ?? null);
          return role === SYSTEM_ROLES.TECHNICAL_SUPPORT;
        }).map((u: any) => ({ id: u.id, name: u.name || u.email || u.id })) : [];
        setSupportOperators(operators);
      } catch {
        // ignore
      }
    }
    loadSupportOperators();
    return () => { mounted = false; };
  }, [open, activeClientId, user]);

  if (!canOpenCreateTicket) return null;

  return (
    <div className={hiddenTrigger ? "contents" : "relative"}>
      {!hiddenTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-[var(--tc-accent)] px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110"
        >
          Criar chamado de suporte
        </button>
      ) : null}
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_25px_80px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#0f1828] dark:text-white">
            <h2 className="mb-4 text-lg font-bold">Novo chamado de suporte</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-500 dark:text-slate-300">Título</label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#ef0001] focus:ring-2 focus:ring-red-500/20 dark:border-white/20 dark:bg-[#0c1220] dark:text-white"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Título do chamado"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-500 dark:text-slate-300">Descrição</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#ef0001] focus:ring-2 focus:ring-red-500/20 dark:border-white/20 dark:bg-[#0c1220] dark:text-white"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o problema ou solicitação"
                />
              </div>
              {supportOperators.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-slate-500 dark:text-slate-300">Atribuir ao suporte técnico</label>
                  <select
                    id="create-support-assignee"
                    aria-label="Atribuir ao suporte técnico"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-[#ef0001] dark:border-white/20 dark:bg-[#0c1220] dark:text-white"
                    value={assignedTo ?? ""}
                    onChange={(e) => setAssignedTo(e.target.value || null)}
                  >
                    <option value="">-- nenhum --</option>
                    {supportOperators.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {error && <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-white/20 dark:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !form.title.trim()}
                className="rounded-xl bg-[#ef0001] px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
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
