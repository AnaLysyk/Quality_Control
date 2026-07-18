"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiAlertTriangle, FiCheckCircle, FiCode, FiGitBranch, FiRefreshCcw, FiSearch } from "react-icons/fi";
import { fetchApi } from "@/backend/api";
import { useProjectContext } from "@/context/ProjectContext";
import type { AutomationAccess } from "@/backend/automations/access";

type CompanyOption = {
  name: string;
  slug: string;
};

type TestCaseRecord = {
  testCase: {
    id: string;
    key: string;
    title: string;
    description?: string | null;
    type: string;
    priority: string;
    automationStatus: string;
    suiteName?: string | null;
    tags: string[];
    lastExecutionStatus?: string | null;
    lastExecutedAt?: string | null;
  };
  automationLink?: {
    specFile?: string | null;
    playwrightProject?: string | null;
    status?: string | null;
    lastStatus?: string | null;
    lastExecutedAt?: string | null;
  } | null;
};

type Props = {
  access: AutomationAccess;
  activeCompanySlug: string | null;
  companies: CompanyOption[];
};

const QUEUE_STATUSES = ["planned", "pending", "review", "approved", "linked", "stable", "broken"];

const AUTOMATION_LABEL: Record<string, string> = {
  planned: "Fila para automatizar",
  pending: "Pendente",
  review: "Em revisão",
  approved: "Aprovado",
  linked: "Vinculado",
  stable: "Estável",
  broken: "Quebrado",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

function getProjectId(activeProject: unknown) {
  const project = (activeProject ?? {}) as Record<string, unknown>;
  return typeof project.id === "string" ? project.id : null;
}

function getProjectLabel(activeProject: unknown) {
  const project = (activeProject ?? {}) as Record<string, unknown>;
  return String(project.name ?? project.slug ?? project.id ?? "Projeto não selecionado");
}

function getAutomationTool(record: TestCaseRecord) {
  if (record.automationLink?.specFile) return "Playwright";
  const tags = record.testCase.tags.join(" ").toLowerCase();
  if (tags.includes("postman")) return "Postman/API";
  if (tags.includes("api")) return "API";
  return "A definir";
}

function groupName(status: string) {
  if (["planned", "pending"].includes(status)) return "Fila para automatizar";
  if (["review", "approved"].includes(status)) return "Em revisão";
  if (["linked", "stable"].includes(status)) return "Vinculados";
  if (status === "broken") return "Quebrados";
  return "Outros";
}

export default function AutomationCasesQueue({ access, activeCompanySlug, companies }: Props) {
  const { activeProject } = useProjectContext();
  const projectId = getProjectId(activeProject);
  const projectLabel = getProjectLabel(activeProject);
  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const selectedCompany = companies.find((company) => company.slug === activeCompanySlug) ?? null;

  useEffect(() => {
    let canceled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ includeIntegrated: "true" });
      if (activeCompanySlug) params.set("companySlug", activeCompanySlug);
      if (projectId) params.set("projectId", projectId);
      const response = await fetchApi(`/api/test-cases?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        if (!canceled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      const payload = (await response.json()) as { items?: TestCaseRecord[] };
      if (!canceled) {
        setItems((payload.items ?? []).filter((item) => QUEUE_STATUSES.includes(item.testCase.automationStatus)));
        setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [activeCompanySlug, projectId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.testCase.automationStatus !== statusFilter) return false;
      if (!term) return true;
      return [item.testCase.key, item.testCase.title, item.testCase.description, item.testCase.suiteName, item.testCase.tags.join(" "), item.automationLink?.specFile]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, query, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, TestCaseRecord[]>();
    for (const item of filtered) {
      const key = groupName(item.testCase.automationStatus);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const metrics = {
    queue: items.filter((item) => ["planned", "pending"].includes(item.testCase.automationStatus)).length,
    review: items.filter((item) => ["review", "approved"].includes(item.testCase.automationStatus)).length,
    linked: items.filter((item) => ["linked", "stable"].includes(item.testCase.automationStatus)).length,
    broken: items.filter((item) => item.testCase.automationStatus === "broken").length,
  };

  return (
    <section data-testid="automation-cases-queue" className="flex min-h-[calc(100vh-7rem)] w-full flex-col gap-3 rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 shadow-sm">
      <header className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              {selectedCompany?.name || activeCompanySlug || "Empresa"} › {projectLabel}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Automação · Repositório de casos</h1>
            <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
              Fila real dos casos marcados como automatizáveis ou já vinculados. Esta tela edita vínculo técnico, não executa automação.
            </p>
          </div>
          <Link href="/casos-de-teste" className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-4 py-2 text-sm font-black">
            Voltar ao repositório
          </Link>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Fila" value={metrics.queue} icon={<FiGitBranch />} />
        <Metric label="Revisão" value={metrics.review} icon={<FiRefreshCcw />} />
        <Metric label="Vinculados" value={metrics.linked} icon={<FiCheckCircle />} />
        <Metric label="Quebrados" value={metrics.broken} icon={<FiAlertTriangle />} />
      </div>

      <article className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(260px,1fr)_220px]">
          <label className="grid gap-1 text-xs font-semibold">
            Buscar
            <span className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tc-text-muted,#6b7280)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, título, suite ou spec" className="min-h-9 w-full rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] pr-3 pl-9 text-xs outline-none focus:border-[var(--tc-accent,#ef0001)]" />
            </span>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Status de automação
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-9 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-3 text-xs outline-none focus:border-[var(--tc-accent,#ef0001)]">
              <option value="all">Todos</option>
              {QUEUE_STATUSES.map((status) => <option key={status} value={status}>{AUTOMATION_LABEL[status] ?? status}</option>)}
            </select>
          </label>
        </div>
      </article>

      <div className="grid flex-1 gap-3 xl:grid-cols-4">
        {loading ? (
          <div className="col-span-full rounded-2xl border border-[var(--tc-border,#d7deea)] p-8 text-center text-sm text-[var(--tc-text-muted,#6b7280)]">Carregando fila de automação...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-10 text-center">
            <FiCode className="mx-auto h-8 w-8 text-[var(--tc-accent,#ef0001)]" />
            <h2 className="mt-3 text-xl font-black">Nenhum caso na fila de automação</h2>
            <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">Marque um caso no repositório como automatizável para ele aparecer aqui.</p>
          </div>
        ) : (
          groups.map(([group, records]) => (
            <section key={group} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--tc-border,#d7deea)] pb-2">
                <h2 className="text-sm font-black">{group}</h2>
                <span className="rounded-full bg-[var(--tc-surface-2,#f8fafc)] px-2 py-0.5 text-xs font-black">{records.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {records.map((record) => (
                  <Link key={record.testCase.id} href={`/automacoes/casos?testCaseId=${encodeURIComponent(record.testCase.id)}`} className="block rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3 transition hover:border-[var(--tc-accent,#ef0001)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-[var(--tc-accent,#ef0001)]">{record.testCase.key}</p>
                        <p className="mt-1 truncate text-sm font-black">{record.testCase.title}</p>
                      </div>
                      <FiCode className="h-4 w-4 shrink-0 text-[var(--tc-text-muted,#6b7280)]" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-bold">
                      <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-2 py-0.5">{AUTOMATION_LABEL[record.testCase.automationStatus] ?? record.testCase.automationStatus}</span>
                      <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-2 py-0.5">{getAutomationTool(record)}</span>
                      <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-2 py-0.5">{PRIORITY_LABEL[record.testCase.priority] ?? record.testCase.priority}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      {!access.canOpen ? <p className="text-xs text-amber-700">Seu perfil pode ter restrições na automação.</p> : null}
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">{label}</p><span className="text-[var(--tc-accent,#ef0001)]">{icon}</span></div><p className="mt-1 text-xl font-black">{value}</p></div>;
}
