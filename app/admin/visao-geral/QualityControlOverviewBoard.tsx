"use client";

import {
  FiActivity,
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClipboard,
  FiLayers,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

import type { CompanyRow, Stats } from "@/backend/quality";

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

type AdminUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  permissionRole?: string | null;
  companyRole?: string | null;
  profileLabel?: string | null;
  companySlug?: string | null;
  company_slug?: string | null;
  companyName?: string | null;
  company_name?: string | null;
  defaultCompanySlug?: string | null;
};

type RunRow = {
  id: string;
  title: string;
  companyName: string;
  project: string;
  total: number;
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
};

type QualityControlOverviewBoardProps = {
  companies: CompanyRow[];
  selectedCompany: CompanyRow | null;
  audit: Audit[];
  defectsInPeriod: Defect[];
  adminUsers: AdminUser[];
  runRows: RunRow[];
  stats: Stats | null;
  planCount: number;
  testCaseCount: number;
  passRate: number | null;
  selectedContextLabel: string;
  periodLabel: string;
  mode: "company" | "user";
  selectedUser: string | null;
};

type MetricCard = {
  label: string;
  value: number | string;
  note: string;
  icon: typeof FiActivity;
};

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function total(stats?: Stats | null) {
  return stats ? stats.pass + stats.fail + stats.blocked + stats.notRun : 0;
}

function keyOf(company: CompanyRow) {
  return company.slug ?? company.id;
}

function eventText(event: Audit) {
  return normalize(`${event.action} ${event.entity_type ?? ""} ${event.entity_label ?? ""}`);
}

function eventMatchesCompany(event: Audit, company: CompanyRow) {
  const text = eventText(event);
  const slug = normalize(company.slug);
  const name = normalize(company.name);
  return Boolean((slug && text.includes(slug)) || (name && text.includes(name)));
}

function defectMatchesCompany(defect: Defect, company: CompanyRow) {
  const text = normalize(`${defect.title} ${defect.status} ${defect.run_id ?? ""}`);
  const slug = normalize(company.slug);
  const name = normalize(company.name);
  return Boolean((slug && text.includes(slug)) || (name && text.includes(name)));
}

function countEvents(events: Audit[], pattern: RegExp) {
  return events.filter((event) => pattern.test(eventText(event))).length;
}

function profileTag(user: AdminUser) {
  const raw = normalize(user.profileLabel ?? user.permissionRole ?? user.role ?? user.companyRole ?? "Usuário");
  if (raw.includes("leader") || raw.includes("lider")) return "Líder TC";
  if (raw.includes("support") || raw.includes("suporte")) return "Suporte";
  if (raw.includes("testing") || raw.includes("tc")) return "Usuário TC";
  if (raw.includes("empresa") || raw.includes("company")) return "Empresa";
  return "Usuário";
}

function userMatchesCompany(user: AdminUser, company: CompanyRow) {
  const text = normalize(
    `${user.companySlug ?? ""} ${user.company_slug ?? ""} ${user.defaultCompanySlug ?? ""} ${user.companyName ?? ""} ${user.company_name ?? ""}`,
  );
  const slug = normalize(company.slug);
  const name = normalize(company.name);
  return Boolean((slug && text.includes(slug)) || (name && text.includes(name)));
}

function runPassRate(row: RunRow) {
  return row.total > 0 ? Math.round((row.pass / row.total) * 100) : null;
}

function formatPercent(value: number | null) {
  return value === null ? "--" : `${value}%`;
}

function MetricTile({ item }: { item: MetricCard }) {
  const Icon = item.icon;
  return (
    <div className="group relative overflow-hidden rounded-[26px] border border-[var(--tc-border)] bg-white/82 p-4 shadow-[0_16px_36px_rgba(1,24,72,.07)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(1,24,72,.11)] dark:bg-white/[0.04]">
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(239,0,1,.45)] to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(239,0,1,.18)] bg-[rgba(239,0,1,.07)] text-[var(--tc-accent)]">
          <Icon />
        </span>
        <span className="rounded-full bg-black/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#64748b] dark:bg-white/10 dark:text-white/45">período</span>
      </div>
      <b className="mt-4 block text-3xl leading-none tracking-[-.05em] text-[#011848] dark:text-white">{item.value}</b>
      <p className="mt-2 text-xs font-black uppercase tracking-[.14em] text-[#64748b] dark:text-white/55">{item.label}</p>
      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-[#64748b] dark:text-white/50">{item.note}</p>
    </div>
  );
}

function CompanyQualityCard({
  company,
  events,
  defects,
  users,
}: {
  company: CompanyRow;
  events: Audit[];
  defects: Defect[];
  users: AdminUser[];
}) {
  const stats = company.releases.reduce<Stats>(
    (acc, release) => {
      if (!release.stats) return acc;
      acc.pass += release.stats.pass;
      acc.fail += release.stats.fail;
      acc.blocked += release.stats.blocked;
      acc.notRun += release.stats.notRun;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );
  const cases = total(stats);
  const passRate = cases > 0 ? Math.round((stats.pass / cases) * 100) : null;
  const plans = new Set(
    company.releases
      .map((release) => {
        const row = release as unknown as Record<string, unknown>;
        return row.project ?? row.app ?? row.qaseProject ?? row.title ?? row.name;
      })
      .filter(Boolean),
  ).size;
  const companyEvents = events.filter((event) => eventMatchesCompany(event, company));
  const companyDefects = defects.filter((defect) => defectMatchesCompany(defect, company));
  const companyUsers = users.filter((user) => userMatchesCompany(user, company));
  const linkedTcUsers = companyUsers.filter((user) => profileTag(user) === "Usuário TC").length;
  const requests = countEvents(companyEvents, /solicit|request|access|acesso/);
  const agenda = countEvents(companyEvents, /agenda|calendar|calend|evento|marcacao|horario/);
  const management = countEvents(companyEvents, /usuario|user|perfil|permission|permissao|empresa|company|projeto|project/);

  return (
    <article className="rounded-[28px] border border-[var(--tc-border)] bg-white/78 p-4 shadow-[0_16px_36px_rgba(1,24,72,.07)] transition hover:-translate-y-0.5 hover:bg-white dark:bg-white/[0.035] dark:hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#64748b] dark:text-white/45">Empresa</p>
          <h3 className="mt-1 truncate text-lg font-black tracking-[-.03em] text-[#011848] dark:text-white">{company.name}</h3>
        </div>
        <span className="rounded-full border border-[var(--tc-border)] px-2 py-1 text-xs font-black text-[#011848] dark:text-white">
          {formatPercent(passRate)}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-[var(--tc-accent)] transition-all" style={{ width: `${passRate ?? 0}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{company.releases.length}</b>runs</span>
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{plans}</b>planos</span>
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{cases}</b>casos</span>
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{companyDefects.length}</b>defeitos</span>
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{requests}</b>solicitações</span>
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{agenda}</b>agenda</span>
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{management}</b>gestão</span>
        <span className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.06]"><b className="block text-base text-[#011848] dark:text-white">{linkedTcUsers || companyUsers.length}</b>usuários</span>
      </div>
    </article>
  );
}

export default function QualityControlOverviewBoard({
  companies,
  selectedCompany,
  audit,
  defectsInPeriod,
  adminUsers,
  runRows,
  stats,
  planCount,
  testCaseCount,
  passRate,
  selectedContextLabel,
  periodLabel,
  mode,
  selectedUser,
}: QualityControlOverviewBoardProps) {
  const requestsCount = countEvents(audit, /solicit|request|access|acesso/);
  const agendaCount = countEvents(audit, /agenda|calendar|calend|evento|marcacao|horario/);
  const managementCount = countEvents(audit, /usuario|user|perfil|permission|permissao|empresa|company|projeto|project/);
  const sourceCompanies = selectedCompany ? [selectedCompany] : companies;
  const userContext = selectedUser ? adminUsers.filter((user) => user.email === selectedUser || user.id === selectedUser) : adminUsers;
  const tcUsers = userContext.filter((user) => profileTag(user) === "Usuário TC").length;

  const metricCards: MetricCard[] = [
    { icon: FiActivity, label: "Runs", value: runRows.length, note: "execuções encontradas no filtro atual" },
    { icon: FiAlertTriangle, label: "Defeitos", value: defectsInPeriod.length, note: "defeitos soltos ou vinculados a runs" },
    { icon: FiClipboard, label: "Planos de teste", value: planCount, note: "planos/projetos dentro do contexto" },
    { icon: FiCheckCircle, label: "Casos de teste", value: testCaseCount, note: "casos avaliados pelo status das runs" },
    { icon: FiShield, label: "Solicitações", value: requestsCount, note: "acessos e solicitações movimentadas" },
    { icon: FiCalendar, label: "Agenda", value: agendaCount, note: "eventos, marcações e horários rastreados" },
    { icon: FiLayers, label: "Gestão", value: managementCount, note: "empresas, projetos, perfis e permissões" },
    { icon: FiUsers, label: "Usuários", value: selectedCompany ? adminUsers.filter((user) => userMatchesCompany(user, selectedCompany)).length : userContext.length, note: `${tcUsers} usuário(s) TC no contexto carregado` },
  ];

  return (
    <section className="rounded-[34px] border border-[var(--tc-border)] bg-white/78 p-5 shadow-[0_18px_46px_rgba(1,24,72,.08)] dark:bg-white/[0.035]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#64748b] dark:text-white/45">
            Controle de qualidade · {selectedContextLabel}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-.05em] text-[#011848] dark:text-white">
            Painel operacional do período
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-[#64748b] dark:text-white/60">
            A estrutura é a mesma para todas as empresas e para uma empresa individual: runs, defeitos, planos, casos, solicitações, agenda, gestão e usuários vinculados respondem ao mesmo filtro de período.
          </p>
        </div>
        <div className="rounded-3xl border border-[var(--tc-border)] bg-black/[0.025] px-4 py-3 text-sm font-black text-[#011848] dark:bg-white/[0.05] dark:text-white">
          <span className="block text-[10px] uppercase tracking-[.16em] text-[#64748b] dark:text-white/45">Saúde geral</span>
          {passRate === null ? "Sem dados" : `${passRate}% aprovação`}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => (
          <MetricTile key={item.label} item={item} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
        <div className="rounded-[28px] border border-[var(--tc-border)] bg-white/70 p-4 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-[-.03em] text-[#011848] dark:text-white">
                {selectedCompany ? "Estrutura individual da empresa" : "Estrutura geral por empresa"}
              </h3>
              <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">
                {selectedCompany ? "Mesmos indicadores, olhando só a empresa selecionada." : "Cada empresa com os mesmos indicadores para comparar saúde e volume."}
              </p>
            </div>
            <span className="rounded-full bg-black/[0.04] px-3 py-2 text-xs font-black text-[#64748b] dark:bg-white/10 dark:text-white/55">
              {periodLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {sourceCompanies.length ? (
              sourceCompanies.slice(0, selectedCompany ? 1 : 6).map((entry) => (
                <CompanyQualityCard key={keyOf(entry)} company={entry} events={audit} defects={defectsInPeriod} users={adminUsers} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--tc-border)] p-4 text-sm font-semibold text-[#64748b] dark:text-white/55">
                Nenhuma empresa encontrada para o filtro atual.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--tc-border)] bg-white/70 p-4 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-[-.03em] text-[#011848] dark:text-white">Runs em destaque</h3>
              <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">Passe o mouse para identificar run, empresa, projeto e resultado.</p>
            </div>
            <FiActivity className="text-[var(--tc-accent)]" />
          </div>

          <div className="mt-4 grid gap-3">
            {runRows.slice(0, 6).map((run) => {
              const rate = runPassRate(run);
              return (
                <article key={run.id} title={`${run.title} · ${run.companyName} · ${run.project}`} className="rounded-2xl border border-[var(--tc-border)] bg-white/70 p-3 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(1,24,72,.08)] dark:bg-white/[0.035]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="line-clamp-1 text-sm text-[#011848] dark:text-white">{run.title}</b>
                      <p className="mt-1 truncate text-xs text-[#64748b] dark:text-white/55">{run.companyName} · {run.project}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-xs font-black dark:bg-white/10">{formatPercent(rate)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1 text-[10px] font-black uppercase tracking-[.1em] text-[#64748b] dark:text-white/45">
                    <span>OK {run.pass}</span>
                    <span>Fail {run.fail}</span>
                    <span>Bloq {run.blocked}</span>
                    <span>Pend {run.notRun}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-[var(--tc-accent)] transition-all" style={{ width: `${rate ?? 0}%` }} />
                  </div>
                </article>
              );
            })}
            {!runRows.length ? (
              <div className="rounded-2xl border border-dashed border-[var(--tc-border)] p-4 text-sm font-semibold text-[#64748b] dark:text-white/55">
                Nenhuma run encontrada no período selecionado.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mode === "user" ? (
        <div className="mt-4 rounded-[28px] border border-[var(--tc-border)] bg-black/[0.025] p-4 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-black tracking-[-.03em] text-[#011848] dark:text-white">Leitura por usuário</h3>
              <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">
                Usuário TC deve permitir visão geral de todas as empresas vinculadas ou uma empresa específica; usuário da empresa mantém leitura restrita à própria empresa.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border)] px-3 py-2 text-xs font-black uppercase tracking-[.12em] text-[#64748b] dark:text-white/55">
              <FiUserCheck /> {selectedUser ? "usuário selecionado" : "todos os usuários"}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
