"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

type CompanyOption = { slug: string; label: string };
type CalendarPayload = { events?: Array<{ companySlug?: string | null; companyName?: string | null }> };
type ScheduleKind = "meeting" | "run" | "runs" | "test_plan";

const KIND_COPY: Record<ScheduleKind, { label: string; title: string; type: "discovery" | "qa_window" | "release"; context: "company" | "user" | "delivery"; marker: string; releaseName: string; checklist: string[]; brianRules: string[] }> = {
  meeting: { label: "Reunião / ligação", title: "Reunião / ligação", type: "discovery", context: "user", marker: "Reunião", releaseName: "Reunião / ligação", checklist: ["Confirmar horário", "Confirmar participantes", "Atualizar status"], brianRules: ["Guardar contexto da reunião"] },
  run: { label: "Entrega de run", title: "Entrega de run", type: "qa_window", context: "delivery", marker: "Run", releaseName: "Entrega de run", checklist: ["Run criada", "Execução validada", "Evidências anexadas", "Resultado comunicado"], brianRules: ["Relacionar run com plano, bugs e evidências"] },
  runs: { label: "Entrega de runs", title: "Entrega de runs", type: "qa_window", context: "delivery", marker: "Runs", releaseName: "Entrega de runs", checklist: ["Runs planejadas", "Responsáveis definidos", "Bloqueios sinalizados", "Resumo final enviado"], brianRules: ["Consolidar status das runs e riscos"] },
  test_plan: { label: "Entrega de plano", title: "Entrega de plano de teste", type: "release", context: "delivery", marker: "Plano", releaseName: "Entrega de plano de teste", checklist: ["Plano revisado", "Casos vinculados", "Runs vinculadas", "Entrega comunicada"], brianRules: ["Relacionar plano com runs, casos e release"] },
};

function defaultDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function normalizeRole(value: unknown) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }

export default function AgendaMeetingSchedulerLite() {
  const { can, normalizedUser, user, accessContext } = usePermissionAccess();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<ScheduleKind>("meeting");
  const [title, setTitle] = useState(KIND_COPY.meeting.title);
  const [startAt, setStartAt] = useState(defaultDateTime);
  const [minutes, setMinutes] = useState("30");
  const [participants, setParticipants] = useState("");
  const [description, setDescription] = useState("");
  const [companySlug, setCompanySlug] = useState("all");
  const [allCompanies, setAllCompanies] = useState<CompanyOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const roles = useMemo(() => Array.from(new Set([accessContext?.role, user?.permissionRole, user?.role, user?.companyRole, ...normalizedUser.roles].map(normalizeRole).filter(Boolean))), [accessContext?.role, normalizedUser.roles, user]);
  const canSeeAllCompanies = user?.isGlobalAdmin === true || (user as { is_global_admin?: boolean } | null)?.is_global_admin === true || roles.some((role) => role === "leader_tc" || role === "technical_support");
  const isCompanyProfile = roles.some((role) => role === "empresa" || role === "company_user");
  const canCreate = can("release_calendar", "create") || can("release_calendar", "edit") || roles.includes("testing_company_user") || canSeeAllCompanies;

  const linkedCompanies = useMemo(() => {
    const map = new Map<string, string>();
    normalizedUser.companies.forEach((company) => { if (company.slug) map.set(company.slug, company.name ?? company.slug); });
    normalizedUser.companySlugs.forEach((slug) => { if (slug) map.set(slug, map.get(slug) ?? slug); });
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [normalizedUser.companies, normalizedUser.companySlugs]);

  useEffect(() => {
    if (!canSeeAllCompanies) return;
    let cancelled = false;
    fetch("/api/release-calendar?scope=all", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: CalendarPayload) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        linkedCompanies.forEach((company) => map.set(company.slug, company.label));
        payload.events?.forEach((event) => { if (event.companySlug) map.set(event.companySlug, event.companyName ?? event.companySlug); });
        setAllCompanies(Array.from(map.entries()).map(([slug, label]) => ({ slug, label })));
      })
      .catch(() => setAllCompanies(linkedCompanies));
    return () => { cancelled = true; };
  }, [canSeeAllCompanies, linkedCompanies]);

  const companies = canSeeAllCompanies ? allCompanies : linkedCompanies;
  const selectedCompany = companies.find((company) => company.slug === companySlug) ?? companies[0] ?? null;

  useEffect(() => {
    if (canSeeAllCompanies) return;
    const first = companies[0]?.slug;
    if (first && (companySlug === "all" || !companies.some((company) => company.slug === companySlug))) setCompanySlug(first);
  }, [canSeeAllCompanies, companies, companySlug]);

  function changeKind(nextKind: ScheduleKind) {
    setKind(nextKind);
    setTitle(KIND_COPY[nextKind].title);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !startAt) return;
    const copy = KIND_COPY[kind];
    const start = new Date(startAt);
    const end = new Date(start.getTime() + (Number(minutes) || 30) * 60 * 1000);
    const company = companySlug === "all" ? null : selectedCompany;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/release-calendar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `${kind}-${Date.now()}`,
          title: title.trim(),
          type: copy.type,
          status: "planned",
          criticality: kind === "meeting" ? "normal" : "high",
          context: company ? copy.context : "user",
          markerLabel: copy.marker,
          audienceProfiles: ["all", "leader_tc", "technical_support", "testing_company_user", "brain"],
          companyId: null,
          companySlug: company?.slug ?? null,
          companyName: company?.label ?? null,
          projectId: null,
          projectSlug: null,
          releaseId: `${kind}-${Date.now()}`,
          releaseName: copy.releaseName,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          participantNames: participants.split(",").map((item) => item.trim()).filter(Boolean),
          description: description.trim() || `${copy.label} criada na Agenda.`,
          checklist: copy.checklist,
          notificationRules: ["Avisar 5 minutos antes", "Exibir em Meus agendamentos", "Exibir na agenda da empresa"],
          brianRules: copy.brianRules,
        }),
      });
      if (!response.ok) throw new Error("Falha ao criar agendamento.");
      setOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar agendamento.");
    } finally { setSaving(false); }
  }

  return (
    <section className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Agendamento</p><h2 className="text-lg font-black text-[#011848] dark:text-white">Reunião, run, runs ou plano</h2><p className="text-xs text-slate-500 dark:text-slate-400">Marca horário, usuários, empresa e dados da entrega na agenda pessoal e da empresa.</p></div>
        <button type="button" onClick={() => setOpen((value) => !value)} disabled={!canCreate} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#ef0001] px-3 text-xs font-black text-white disabled:opacity-50"><FiPlus /> Agendar</button>
      </div>
      {open ? <form onSubmit={submit} className="mt-3 grid gap-2 lg:grid-cols-[180px_1fr_220px_110px_1fr_auto]"><select value={kind} onChange={(event) => changeKind(event.target.value as ScheduleKind)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950">{Object.entries(KIND_COPY).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950" /><input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950" /><input value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="min" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950" />{isCompanyProfile ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black dark:border-white/10 dark:bg-slate-950">{selectedCompany?.label ?? "Empresa"}</div> : <select value={companySlug} onChange={(event) => setCompanySlug(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950">{canSeeAllCompanies ? <option value="all">Sem empresa específica</option> : null}{companies.map((company) => <option key={company.slug} value={company.slug}>{company.label}</option>)}</select>}<button disabled={saving} className="rounded-xl bg-[#011848] px-4 py-2 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#011848]">Salvar</button><input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Usuários/participantes" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950 lg:col-span-2" /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dados da entrega, run ou plano" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950 lg:col-span-4" />{error ? <p className="text-sm font-semibold text-red-600 lg:col-span-6">{error}</p> : null}</form> : null}
    </section>
  );
}
