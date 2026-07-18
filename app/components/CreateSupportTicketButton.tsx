"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";

type CreateSupportTicketButtonProps = {
  hiddenTrigger?: boolean;
};

export const OPEN_SUPPORT_TICKET_MODAL_EVENT = "qc:open-support-ticket-modal";

const fieldClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#ef0001] focus:ring-2 focus:ring-red-500/20 dark:border-white/15 dark:bg-[#07111f] dark:text-white dark:placeholder:text-slate-500";

const labelClassName = "text-sm font-semibold text-slate-700 dark:text-slate-300";

export default function CreateSupportTicketButton({ hiddenTrigger = false }: CreateSupportTicketButtonProps) {
  const { user, can, normalizedUser } = usePermissionAccess();
  const { activeClientSlug, activeClientId } = useClientContext();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", evidence: "" });
  const [supportOperators, setSupportOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  const canOpenCreateTicket = Boolean(user) && can("support", "create") && can("support", "modal");

  const fullDescription = useMemo(() => {
    const description = form.description.trim();
    const evidence = form.evidence.trim();
    if (!evidence) return description;
    return [description, "", "Evidência:", evidence].filter(Boolean).join("\n");
  }, [form.description, form.evidence]);

  const resetForm = () => {
    setForm({ title: "", description: "", evidence: "" });
    setAssignedTo(null);
    setError(null);
  };

  const closeModal = () => {
    setOpen(false);
    setError(null);
  };

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
        description: fullDescription,
        type: "tarefa",
        priority: "medium",
        tags: form.evidence.trim() ? ["evidencia"] : undefined,
        companySlug: activeClientSlug ?? normalizedUser.primaryCompanySlug ?? normalizedUser.defaultCompanySlug ?? null,
        companyId: activeClientId ?? (user as any)?.company?.id ?? (user as any)?.companyId ?? null,
      };
      if (assignedTo) bodyPayload.assignedToUserId = assignedTo;

      const res = await fetch("/api/suportes", {
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
      resetForm();
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
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-md dark:bg-black/65"
          role="dialog"
          aria-modal="true"
        >
          <div className="my-auto w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_25px_80px_rgba(15,23,42,0.30)] dark:border-white/10 dark:bg-[#0b1220] dark:text-white dark:shadow-[0_25px_100px_rgba(0,0,0,0.55)]">
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Suporte</p>
              <h2 className="text-xl font-black text-[#011848] dark:text-white">Novo chamado de suporte</h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Informe o problema e cole a evidência, print, link ou log para acelerar a análise.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClassName}>Título</label>
                <input
                  className={fieldClassName}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Título do chamado"
                />
              </div>
              <div>
                <label className={labelClassName}>Descrição</label>
                <textarea
                  className={fieldClassName}
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o problema ou solicitação"
                />
              </div>
              <div>
                <label className={labelClassName}>Evidência</label>
                <textarea
                  className={fieldClassName}
                  rows={3}
                  value={form.evidence}
                  onChange={(e) => setForm((prev) => ({ ...prev, evidence: e.target.value }))}
                  placeholder="Cole aqui print, link, erro do console, log ou caminho da evidência"
                />
                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  A evidência será salva junto na descrição do chamado.
                </p>
              </div>
              {supportOperators.length > 0 && (
                <div>
                  <label className={labelClassName}>Atribuir ao administrador</label>
                  <select
                    id="create-support-assignee"
                    aria-label="Atribuir ao administrador"
                    className={fieldClassName}
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
              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>}
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 dark:border-white/15 dark:bg-white/10 dark:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !form.title.trim()}
                className="rounded-xl bg-[#ef0001] px-4 py-2 text-sm font-bold text-white shadow transition hover:brightness-110 disabled:opacity-60"
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
