"use client";

import { FormEvent, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

export type AgendaCompanyOption = {
  slug: string;
  label: string;
};

type MeetingSchedulerProps = {
  view: "mine" | "company" | "management";
  companies: AgendaCompanyOption[];
  canSeeAllCompanies: boolean;
  isCompanyProfile: boolean;
  onCreated: (startAt: string) => void | Promise<void>;
};

function defaultStartAt() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function splitParticipants(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MeetingScheduler({ view, companies, canSeeAllCompanies, isCompanyProfile, onCreated }: MeetingSchedulerProps) {
  const { can } = usePermissionAccess();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Reunião / ligação direta");
  const [startAt, setStartAt] = useState(defaultStartAt);
  const [duration, setDuration] = useState("30");
  const [participants, setParticipants] = useState("");
  const [description, setDescription] = useState("");
  const [companySlug, setCompanySlug] = useState(companies[0]?.slug ?? "all");

  const canCreate = can("release_calendar", "create") || can("release_calendar", "edit");
  const selectedCompany = useMemo(() => companies.find((company) => company.slug === companySlug) ?? companies[0] ?? null, [companies, companySlug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !startAt) {
      setError("Informe título e horário da reunião.");
      return;
    }

    const start = new Date(startAt);
    const minutes = Number(duration) > 0 ? Number(duration) : 30;
    const end = new Date(start.getTime() + minutes * 60 * 1000);
    const company = companySlug === "all" ? null : selectedCompany;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/release-calendar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `meeting-${Date.now()}`,
          title: title.trim(),
          type: "discovery",
          status: "planned",
          criticality: "normal",
          context: view === "mine" ? "user" : "company",
          markerLabel: "Reunião",
          audienceProfiles: ["all", "brain"],
          companyId: null,
          companySlug: company?.slug ?? null,
          companyName: company?.label ?? null,
          projectId: null,
          projectSlug: null,
          releaseId: `meeting-${Date.now()}`,
          releaseName: "Reunião / ligação direta",
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          participantNames: splitParticipants(participants),
          description: description.trim() || "Reunião criada pela Agenda a partir de ligação direta.",
          checklist: ["Registrar horário", "Confirmar participantes", "Marcar realizada ou não realizada após a reunião"],
          notificationRules: ["Avisar 5 minutos antes", "Exibir em Meus agendamentos", "Exibir na agenda da empresa quando houver empresa"],
          brianRules: ["Guardar contexto da reunião", "Relacionar com Chat/Brain quando a origem for conversa"],
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Falha ao criar reunião.");

      setOpen(false);
      setTitle("Reunião / ligação direta");
      setStartAt(defaultStartAt());
      setDuration("30");
      setParticipants("");
      setDescription("");
      await onCreated(start.toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar reunião.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Agendamento</p>
          <h2 className="text-lg font-black text-[#011848] dark:text-white">Reunião ou ligação direta</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Marca horário, participantes, empresa e dados da reunião na agenda pessoal e da empresa.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} disabled={!canCreate} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#ef0001] bg-[#ef0001] px-3 text-xs font-black text-white disabled:opacity-50">
          <FiPlus /> Agendar ligação
        </button>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-3 grid gap-2 lg:grid-cols-[1fr_220px_120px_1fr_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título da reunião" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950" />
          <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950" />
          <input type="number" min="15" step="15" value={duration} onChange={(event) => setDuration(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950" />
          {isCompanyProfile ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black dark:border-white/10 dark:bg-slate-950">{selectedCompany?.label ?? "Empresa"}</div>
          ) : (
            <select value={companySlug} onChange={(event) => setCompanySlug(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950">
              {canSeeAllCompanies ? <option value="all">Sem empresa específica</option> : null}
              {companies.map((company) => <option key={company.slug} value={company.slug}>{company.label}</option>)}
            </select>
          )}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#011848] px-4 py-2 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#011848]">Salvar</button>
          <input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Participantes separados por vírgula" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950 lg:col-span-2" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dados/observação da reunião" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950 lg:col-span-3" />
          {error ? <p className="text-sm font-semibold text-red-600 dark:text-red-300 lg:col-span-5">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
