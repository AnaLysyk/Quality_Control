"use client";

import { useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiSearch,
  FiShield,
  FiUsers,
} from "react-icons/fi";

import { fetchApi } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import type { CompanyRow, Stats } from "@/lib/quality";
import { buildPieGradient } from "./pieChartUtils";

type Overview = {
  companies: CompanyRow[];
  releaseCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
};

type Audit = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  entity_label: string | null;
  entity_type?: string | null;
};

type Defect = {
  id: string;
  title: string;
  status: string;
  run_id?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Mode = "company" | "user";

type Slice = {
  label: string;
  value: number;
  color: string;
};

const FIRST_ITEMS = 6;
const FIRST_EVENTS = 5;
const periods = [7, 30, 90] as const;

const selectedCard =
  "relative flex w-[78vw] min-w-56 max-w-72 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-[rgba(239,0,1,.28)] bg-white p-4 text-left shadow-[0_24px_44px_rgba(1,24,72,.12)] ring-1 ring-[rgba(239,0,1,.16)] dark:bg-[#101d32]";
const card =
  "relative flex w-[78vw] min-w-56 max-w-72 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-[var(--tc-border)] bg-white p-4 text-left transition hover:bg-[#f8fbff] dark:bg-[#0b1628] dark:hover:bg-[#101f35]";
const statCard =
  "rounded-[22px] border border-white/15 bg-white/10 p-4 text-white shadow-[0_18px_38px_rgba(1,24,72,.12)] backdrop-blur-sm ring-1 ring-white/5";

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function shortDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "--";
}

function total(stats?: Stats | null) {
  return stats ? stats.pass + stats.fail + stats.blocked + stats.notRun : 0;
}

function keyOf(company: CompanyRow) {
  return company.slug ?? company.id;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function daysBetween(start: string, end: string) {
  const startAt = new Date(`${start}T00:00:00`).getTime();
  const endAt = new Date(`${end}T23:59:59`).getTime();
  return Number.isFinite(startAt) && Number.isFinite(endAt) && endAt >= startAt
    ? Math.max(1, Math.ceil((endAt - startAt) / 86400000))
    : 30;
}

function mergeStats(releases: CompanyRow["releases"]): Stats {
  return releases.reduce<Stats>(
    (acc, item) => {
      if (!item.stats) return acc;
      acc.pass += item.stats.pass;
      acc.fail += item.stats.fail;
      acc.blocked += item.stats.blocked;
      acc.notRun += item.stats.notRun;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );
}

function Pie({ title, slices, note }: { title: string; note: string; slices: Slice[] }) {
  const sum = slices.reduce((acc, slice) => acc + slice.value, 0);
  if (!sum) return null;

  return (
    <section className="tc-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-[-.04em]">{title}</h2>
          <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{note}</p>
        </div>
        <div className="relative h-32 w-32 rounded-full" style={{ background: buildPieGradient(slices) }}>
          <div className="absolute inset-8 flex items-center justify-center rounded-full bg-white text-sm font-black dark:bg-[#07111f]">
            {sum}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {slices
          .filter((slice) => slice.value > 0)
          .map((slice) => (
            <div
              key={slice.label}
              className="flex justify-between rounded-2xl border border-[var(--tc-border)] bg-white px-3 py-2 text-sm dark:bg-[#0b1628]"
            >
              <span className="flex items-center gap-2 text-[#64748b] dark:text-white/60">
                <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                {slice.label}
              </span>
              <b>{slice.value}</b>
            </div>
          ))}
      </div>
    </section>
  );
}

function eventKind(item: Audit) {
  const text = normalize(`${item.action} ${item.entity_type ?? ""} ${item.entity_label ?? ""}`);
  if (/status|update|alter/.test(text)) return { title: "Status atualizado", color: "bg-sky-500" };
  if (/run|execu/.test(text)) return { title: "Execução movimentada", color: "bg-violet-500" };
  if (/defeito|defect|bug|falha/.test(text)) return { title: "Defeito movimentado", color: "bg-rose-500" };
  if (/plano|plan|caso|case|repositorio/.test(text)) return { title: "Teste criado ou atualizado", color: "bg-emerald-500" };
  return { title: "Movimentação", color: "bg-slate-500" };
}

function StatCard({ icon: Icon, value, label }: { icon: typeof FiActivity; value: string | number; label: string }) {
  return (
    <div className={statCard}>
      <Icon className="text-white/72" />
      <b className="mt-2 block text-2xl">{value}</b>
      <small className="font-semibold text-white/72">{label}</small>
    </div>
  );
}

export default function VisaoGeralCompacta() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [period, setPeriod] = useState<(typeof periods)[number]>(30);
  const [mode, setMode] = useState<Mode>("company");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [visibleCards, setVisibleCards] = useState(FIRST_ITEMS);
  const [visibleEvents, setVisibleEvents] = useState(FIRST_EVENTS);
  const [loading, setLoading] = useState(false);

  const hasRange = Boolean(from && to);
  const effectivePeriod = hasRange ? daysBetween(from, to) : period;

  useEffect(() => {
    let ok = true;
    setLoading(true);
    fetchApi(`/api/admin/quality/overview?period=${effectivePeriod}`, { cache: "no-store" })
      .then((response) => response.json().then((json) => ({ response, json })).catch(() => ({ response, json: null })))
      .then(({ response, json }) => ok && setOverview(response.ok ? unwrapEnvelopeData<Overview>(json) ?? json : null))
      .catch(() => ok && setOverview(null))
      .finally(() => ok && setLoading(false));
    return () => {
      ok = false;
    };
  }, [effectivePeriod]);

  useEffect(() => {
    let ok = true;
    const id = window.setTimeout(() => {
      Promise.all([
        fetchApi("/api/admin/audit-logs?limit=12", { cache: "no-store" }),
        fetchApi(selectedCompany ? `/api/admin/defeitos?company=${encodeURIComponent(selectedCompany)}` : "/api/admin/defeitos", {
          cache: "no-store",
        }),
      ])
        .then(async ([auditResponse, defectResponse]) => {
          const auditJson = await auditResponse.json().catch(() => null);
          const defectJson = await defectResponse.json().catch(() => null);
          const auditData = auditResponse.ok ? unwrapEnvelopeData<{ items?: Audit[] }>(auditJson) ?? auditJson : null;
          const defectData = defectResponse.ok ? unwrapEnvelopeData<{ items?: Defect[] }>(defectJson) ?? defectJson : null;
          if (!ok) return;
          setAudit(Array.isArray(auditData?.items) ? auditData.items : []);
          setDefects(Array.isArray(defectData?.items) ? defectData.items : []);
        })
        .catch(() => {
          if (!ok) return;
          setAudit([]);
          setDefects([]);
        });
    }, 500);
    return () => {
      ok = false;
      window.clearTimeout(id);
    };
  }, [selectedCompany, effectivePeriod]);

  useEffect(() => {
    setVisibleCards(FIRST_ITEMS);
    setVisibleEvents(FIRST_EVENTS);
  }, [mode, query, selectedCompany, effectivePeriod]);

  const companies = overview?.companies ?? [];
  const company = selectedCompany ? companies.find((entry) => keyOf(entry) === selectedCompany) ?? null : null;
  const releases = company ? company.releases : companies.flatMap((entry) => entry.releases);
  const stats = company ? mergeStats(company.releases) : overview?.globalStats ?? null;
  const filteredCompanies = companies.filter((entry) => normalize(`${entry.name} ${entry.slug ?? ""}`).includes(normalize(query)));
  const shownCompanies = filteredCompanies.slice(0, visibleCards);
  const shownEvents = audit.slice(0, visibleEvents);
  const linkedDefects = defects.filter((defect) => defect.run_id !== null && defect.run_id !== undefined && String(defect.run_id).trim()).length;
  const passRate = stats ? Math.round((stats.pass / Math.max(1, total(stats))) * 100) : 0;

  return (
    <div className="min-h-screen bg-white text-[#011848] dark:bg-[#07111f] dark:text-white">
      <div className="flex flex-col gap-4 px-3 py-4 sm:px-4 lg:px-8">
        <section className="tc-hero-panel">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="tc-hero-title">Visão Geral</h1>
                <p className="mt-1 text-sm font-semibold text-white/70">
                  {company?.name ?? "Operação geral"} · {hasRange ? `${shortDate(from)} até ${shortDate(to)}` : `últimos ${period} dias`}
                </p>
              </div>
              <div className="relative flex flex-wrap gap-2">
                {loading ? <span className="self-center text-xs font-black uppercase tracking-[.22em] text-white/70">Atualizando...</span> : null}
                <div className="flex gap-1 rounded-2xl border border-white/16 bg-white/10 p-1">
                  {periods.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setPeriod(item);
                        setFrom("");
                        setTo("");
                      }}
                      className={!hasRange && period === item ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}
                    >
                      {item === 7 ? "Semana" : `${item} dias`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCalendar((value) => !value)}
                    className={hasRange ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}
                  >
                    <FiCalendar className="inline" /> Período
                  </button>
                </div>
                {showCalendar ? (
                  <div className="absolute right-0 top-[calc(100%+.5rem)] z-30 w-80 rounded-3xl border border-white/16 bg-white p-4 text-[#011848] shadow-2xl dark:bg-[#07111f] dark:text-white">
                    <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--tc-text-muted)]">Filtrar por período</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-xs font-bold">
                        De
                        <input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" />
                      </label>
                      <label className="text-xs font-bold">
                        Até
                        <input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" />
                      </label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (draftFrom && draftTo) {
                            setFrom(draftFrom);
                            setTo(draftTo);
                            setShowCalendar(false);
                          }
                        }}
                        className="rounded-xl bg-[var(--tc-primary)] px-3 py-2 text-xs font-black text-white"
                      >
                        Aplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFrom("");
                          setTo("");
                          setDraftFrom("");
                          setDraftTo("");
                        }}
                        className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/12 pt-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard icon={FiActivity} value={releases.length} label="Runs" />
              <StatCard icon={FiShield} value={`${passRate}%`} label="Aprovação" />
              <StatCard icon={FiAlertTriangle} value={defects.length} label="Defeitos" />
              <StatCard icon={FiUsers} value={audit.length} label="Ações" />
            </div>
          </div>
        </section>

        <section className="tc-panel">
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("company")} className={`tc-button-${mode === "company" ? "primary" : "secondary"}`}>
                <FiBriefcase /> Empresa
              </button>
              <button type="button" onClick={() => setMode("user")} className={`tc-button-${mode === "user" ? "primary" : "secondary"}`}>
                <FiUsers /> Usuário
              </button>
            </div>
            <label className="w-full">
              <div className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#07111f]">
                <FiSearch />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa" className="w-full bg-transparent text-sm outline-none" />
              </div>
            </label>
          </div>
          <div className="mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3">
              {mode === "company" ? (
                <>
                  <button type="button" onClick={() => setSelectedCompany(null)} className={selectedCompany === null ? selectedCard : card}>
                    <span className="absolute inset-y-0 left-0 w-1.5 bg-[var(--tc-accent)]" />
                    <b>Todas as empresas</b>
                    <p className="text-sm text-[#64748b] dark:text-white/60">{companies.length} empresas liberadas</p>
                  </button>
                  {shownCompanies.map((entry) => (
                    <button key={keyOf(entry)} type="button" onClick={() => setSelectedCompany(keyOf(entry))} className={selectedCompany === keyOf(entry) ? selectedCard : card}>
                      {selectedCompany === keyOf(entry) ? <span className="absolute inset-y-0 left-0 w-1.5 bg-[var(--tc-accent)]" /> : null}
                      <div className="flex gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef3ff] font-black dark:bg-[#13213a]">
                          {entry.logo ? <img src={entry.logo} alt={entry.name} className="h-full w-full rounded-2xl object-cover" /> : initials(entry.name)}
                        </div>
                        <div>
                          <b>{entry.name}</b>
                          <p className="text-xs text-[#64748b] dark:text-white/60">{entry.releases.length} runs</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredCompanies.length > shownCompanies.length ? (
                    <button type="button" onClick={() => setVisibleCards((value) => value + FIRST_ITEMS)} className={card}>
                      <b>Ver mais empresas</b>
                      <p className="text-sm text-[#64748b] dark:text-white/60">Carrega mais itens sem renderizar tudo.</p>
                    </button>
                  ) : null}
                </>
              ) : (
                <button type="button" className={selectedCard}>
                  <b>Usuários</b>
                  <p className="text-sm text-[#64748b] dark:text-white/60">Busca e eventos carregam por demanda.</p>
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,.85fr)_minmax(360px,1.15fr)]">
          <div className="flex flex-col gap-4">
            <Pie
              title="Runs por status"
              note="Distribuição do contexto filtrado"
              slices={[
                { label: "Aprovados", value: stats?.pass ?? 0, color: "#22c55e" },
                { label: "Reprovados", value: stats?.fail ?? 0, color: "#ef4444" },
                { label: "Bloqueados", value: stats?.blocked ?? 0, color: "#f59e0b" },
                { label: "Em andamento", value: stats?.notRun ?? 0, color: "#60a5fa" },
              ]}
            />
            <Pie
              title="Defeitos"
              note={`${linkedDefects} vinculados a runs · ${defects.length - linkedDefects} soltos`}
              slices={[
                { label: "Com run", value: linkedDefects, color: "#8b5cf6" },
                { label: "Soltos", value: defects.length - linkedDefects, color: "#ef4444" },
              ]}
            />
          </div>
          <section className="tc-panel">
            <h2 className="text-xl font-black tracking-[-.04em]">Eventos recentes</h2>
            <div className="mt-5 space-y-4">
              {shownEvents.length ? (
                shownEvents.map((event) => {
                  const meta = eventKind(event);
                  return (
                    <div key={event.id} className="flex gap-3">
                      <span className={`mt-1 h-9 w-9 rounded-2xl ${meta.color}`} />
                      <div className="flex-1 rounded-3xl border border-[var(--tc-border)] bg-white p-4 dark:bg-[#0b1628]">
                        <b>{meta.title}</b>
                        <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{event.entity_label ?? event.action}</p>
                        <small>{shortDate(event.created_at)} · {event.actor_email ?? "Sistema"}</small>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-[var(--tc-border)] p-4 text-sm text-[#64748b] dark:text-white/60">Nenhum evento encontrado.</p>
              )}
              {audit.length > shownEvents.length ? (
                <button type="button" onClick={() => setVisibleEvents((value) => value + FIRST_EVENTS)} className="w-full rounded-2xl border border-[var(--tc-border)] px-4 py-3 text-sm font-black">
                  Ver mais eventos
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
