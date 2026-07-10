"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FiAlertCircle,
  FiArrowRight,
  FiBarChart2,
  FiBookOpen,
  FiCheckCircle,
  FiClipboard,
  FiFileText,
  FiFolder,
  FiLink,
  FiPlayCircle,
  FiPlus,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
import { fetchApi } from "@/lib/api";
import { useProjectContext } from "@/lib/core/project/ProjectContext";

type ProjectItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  source?: string | null;
  qaseProjectCode?: string | null;
  jiraProjectKey?: string | null;
  manualCreationDisabled?: boolean;
};

type ProjectDraft = {
  name: string;
  slug: string;
  description: string;
  qaseProjectCode: string;
  jiraProjectKey: string;
  manualCreationDisabled: boolean;
};

type SourceFilter = "all" | "manual" | "qase";

type OperationRoute = "dashboard" | "casos" | "defeitos" | "planos" | "runs" | "documentos";

const OPERATION_MODULES: Array<{
  id: OperationRoute;
  label: string;
  description: string;
  icon: typeof FiBarChart2;
}> = [
  { id: "dashboard", label: "Dashboard", description: "Indicadores do projeto", icon: FiBarChart2 },
  { id: "casos", label: "Casos", description: "Repositório de casos", icon: FiClipboard },
  { id: "defeitos", label: "Defeitos", description: "Bugs e pendências", icon: FiAlertCircle },
  { id: "planos", label: "Planos", description: "Planos de teste", icon: FiBookOpen },
  { id: "runs", label: "Runs", description: "Execuções", icon: FiPlayCircle },
  { id: "documentos", label: "Docs", description: "Documentação", icon: FiFileText },
];

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getProjectSource(project: ProjectItem): "manual" | "qase" {
  const source = String(project.source ?? "manual").toLowerCase();
  return source === "qase" || Boolean(project.qaseProjectCode) ? "qase" : "manual";
}

function sourceLabel(project: ProjectItem) {
  if (getProjectSource(project) === "qase") {
    return `Qase${project.qaseProjectCode ? `: ${project.qaseProjectCode}` : ""}`;
  }
  return "Manual";
}

function sourceClass(project: ProjectItem) {
  if (getProjectSource(project) === "qase") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function makeProjectKey(project: ProjectItem) {
  return project.qaseProjectCode ? `qase:${project.qaseProjectCode.toUpperCase()}` : `manual:${project.slug}`;
}

function projectQuery(companySlug: string, project: ProjectItem) {
  const params = new URLSearchParams({ companySlug, projectSlug: project.slug });
  if (project.qaseProjectCode) params.set("projectCode", project.qaseProjectCode);
  return params;
}

function operationUrl(companySlug: string, project: ProjectItem, route: OperationRoute = "dashboard") {
  const params = projectQuery(companySlug, project);

  if (route === "casos") return `/empresas/${companySlug}/casos-de-teste?${params.toString()}`;
  if (route === "documentos") return `/documentos?${params.toString()}`;
  if (route === "planos") return `/empresas/${companySlug}/planos-de-teste?${params.toString()}`;
  if (route === "runs") return `/empresas/${companySlug}/runs?${params.toString()}`;
  if (route === "defeitos") return `/empresas/${companySlug}/defeitos?${params.toString()}`;
  return `/empresas/${companySlug}/dashboard?${params.toString()}`;
}

export default function CompanyProjectsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { refreshProjects, setActiveProject, activeProjectSlug } = useProjectContext();
  const companySlug = String(slug ?? "");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>({
    name: "",
    slug: "",
    description: "",
    qaseProjectCode: "",
    jiraProjectKey: "",
    manualCreationDisabled: false,
  });

  async function loadProjects(forceQase = false) {
    if (!companySlug) return;
    setLoading(true);
    setError(null);
    if (forceQase) setSyncing(true);
    try {
      const [projectRes, appRes, defectsRes] = await Promise.all([
        fetchApi(`/api/projects?companySlug=${encodeURIComponent(companySlug)}`),
        fetchApi(`/api/applications?companySlug=${encodeURIComponent(companySlug)}`),
        fetchApi(`/api/company-defects?companySlug=${encodeURIComponent(companySlug)}${forceQase ? "&refresh=1" : ""}`),
      ]);

      const projectJson = await projectRes.json().catch(() => null);
      const appJson = await appRes.json().catch(() => null);
      const defectsJson = await defectsRes.json().catch(() => null);

      const manualProjects: ProjectItem[] = Array.isArray(projectJson?.projects)
        ? projectJson.projects.map((item: ProjectItem) => ({ ...item, source: item.source ?? "manual" }))
        : [];
      const applicationProjects: ProjectItem[] = Array.isArray(appJson?.items)
        ? appJson.items.map((item: ProjectItem) => ({
            ...item,
            source: item.source ?? (item.qaseProjectCode ? "qase" : "manual"),
          }))
        : [];
      const qaseCatalogProjects: ProjectItem[] = Array.isArray(defectsJson?.applications)
        ? defectsJson.applications.map((item: { name: string; projectCode?: string | null; source?: string | null }) => ({
            id: `qase-${item.projectCode ?? normalizeSlug(item.name)}`,
            name: item.name,
            slug: normalizeSlug(item.projectCode ?? item.name),
            description: "Projeto integrado pelo Qase no operacional da empresa.",
            qaseProjectCode: item.projectCode ?? null,
            source: item.source ?? "qase",
          }))
        : [];

      const merged = new Map<string, ProjectItem>();
      [...manualProjects, ...applicationProjects, ...qaseCatalogProjects].forEach((item) => {
        const key = makeProjectKey(item);
        if (!merged.has(key)) merged.set(key, item);
      });

      setProjects(
        Array.from(merged.values()).sort((left, right) =>
          left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
        ),
      );
    } catch {
      setProjects([]);
      setError("Não foi possível carregar os projetos da empresa.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    void loadProjects(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySlug]);

  const manualCount = projects.filter((project) => getProjectSource(project) === "manual").length;
  const qaseCount = projects.filter((project) => getProjectSource(project) === "qase").length;
  const activeCount = projects.length;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects.filter((project) => {
      const source = getProjectSource(project);
      if (sourceFilter !== "all" && source !== sourceFilter) return false;
      if (!term) return true;
      return [project.name, project.slug, project.description ?? "", project.qaseProjectCode ?? "", project.source ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [projects, query, sourceFilter]);

  async function syncQase() {
    await loadProjects(true);
    await refreshProjects();
  }

  async function openOperation(project: ProjectItem, route: OperationRoute = "dashboard") {
    await refreshProjects();
    setActiveProject(project.qaseProjectCode ?? project.slug);
    router.push(operationUrl(companySlug, project, route));
  }

  async function createProject() {
    const name = draft.name.trim();
    const slugValue = normalizeSlug(draft.slug || draft.name);
    if (!name || !slugValue) {
      setError("Informe nome e slug para criar o projeto.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug,
          name,
          slug: slugValue,
          description: draft.description.trim() || undefined,
          iconKey: "folder",
          qaseProjectCode: draft.qaseProjectCode.trim() || undefined,
          jiraProjectKey: draft.jiraProjectKey.trim() || undefined,
          manualCreationDisabled: draft.manualCreationDisabled,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Erro ao criar projeto.");
      setCreateOpen(false);
      setDraft({ name: "", slug: "", description: "", qaseProjectCode: "", jiraProjectKey: "", manualCreationDisabled: false });
      await loadProjects(false);
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar projeto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-(--page-bg,#f8fafc) px-3 py-4 text-(--page-text,#0b1a3c) sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-550 flex-col gap-5">
        <Breadcrumb items={[{ label: "Empresa", href: `/empresas/${companySlug}/dashboard` }, { label: "Projetos" }]} />

        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20)_0%,transparent_26%),linear-gradient(135deg,#011848_0%,#082457_42%,#4b0f2f_76%,#ef0001_100%)] px-6 py-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Operacional da empresa</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Projetos e operações</h1>
              <p className="mt-3 text-sm leading-6 text-white/82 sm:text-base">
                Cada aplicação vira uma operação independente de qualidade. Ao abrir um projeto, dashboard, casos, defeitos, planos, runs e documentos passam a usar o mesmo escopo.
              </p>
            </div>
            <div className="grid min-w-full grid-cols-3 gap-2 sm:min-w-[440px]">
              <StatCard label="Projetos" value={activeCount} />
              <StatCard label="Qase" value={qaseCount} />
              <StatCard label="Manuais" value={manualCount} />
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight">Lista de projetos</h2>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Filtre por origem, sincronize Qase e abra a operação mantendo o escopo ativo.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void syncQase()} disabled={syncing} className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) px-4 py-2 text-sm font-semibold disabled:opacity-60">
                <FiRefreshCw className={syncing ? "animate-spin" : ""} /> {syncing ? "Sincronizando" : "Sincronizar Qase"}
              </button>
              <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-bold text-white">
                <FiPlus /> Novo projeto
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto, slug ou código Qase" className="min-h-11 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white pr-4 pl-11 text-sm outline-none" />
            </label>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)} className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold">
              <option value="all">Todas as origens</option>
              <option value="qase">Qase</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

          <div className="mt-5 grid gap-3">
            {loading ? <p className="text-sm text-(--tc-text-secondary,#4b5563)">Carregando projetos...</p> : null}
            {!loading && filtered.length === 0 ? <p className="rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">Nenhum projeto encontrado.</p> : null}
            {filtered.map((project) => (
              <article key={makeProjectKey(project)} className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black tracking-tight text-(--tc-text,#0b1a3c)">{project.name}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${sourceClass(project)}`}>{sourceLabel(project)}</span>
                      {activeProjectSlug === (project.qaseProjectCode ?? project.slug) ? <span className="inline-flex items-center gap-1 rounded-full border border-(--tc-accent,#ef0001) bg-red-50 px-2.5 py-1 text-xs font-bold text-(--tc-accent,#ef0001)"><FiCheckCircle /> Ativo</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{project.description || "Sem descrição."}</p>
                    <p className="mt-2 text-xs font-semibold text-(--tc-text-muted,#6b7280)">
                      Slug: {project.slug}
                      {project.qaseProjectCode ? ` · Qase: ${project.qaseProjectCode}` : ""}
                      {project.jiraProjectKey ? ` · Jira: ${project.jiraProjectKey}` : ""}
                      {project.manualCreationDisabled ? " · Só integração (criação manual desabilitada)" : ""}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[540px]">
                    {OPERATION_MODULES.map((module) => {
                      const Icon = module.icon;
                      return (
                        <button key={module.id} type="button" onClick={() => void openOperation(project, module.id)} className="group flex items-center justify-between gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-left text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)">
                          <span className="inline-flex items-center gap-2"><Icon /> {module.label}</span>
                          <FiArrowRight className="opacity-50 transition group-hover:translate-x-0.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Novo projeto</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight">Criar projeto manual</h3>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-full border border-(--tc-border,#d7deea) px-3 py-1 text-sm font-bold">×</button>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">Nome
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, slug: current.slug || normalizeSlug(event.target.value) }))} className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) px-4" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">Slug
                <input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: normalizeSlug(event.target.value) }))} className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) px-4" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">Descrição
                <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} className="rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3" />
              </label>

              <div className="mt-2 grid gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Integração por projeto</p>
                <label className="grid gap-2 text-sm font-semibold">Código do projeto no Qase
                  <input value={draft.qaseProjectCode} onChange={(event) => setDraft((current) => ({ ...current, qaseProjectCode: event.target.value }))} placeholder="Ex: QC" className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4" />
                </label>
                <label className="grid gap-2 text-sm font-semibold">Chave do projeto no Jira
                  <input value={draft.jiraProjectKey} onChange={(event) => setDraft((current) => ({ ...current, jiraProjectKey: event.target.value }))} placeholder="Ex: SUP" className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4" />
                </label>
                <p className="text-xs text-(--tc-text-secondary,#4b5563)">
                  As credenciais (token/URL) do Qase e do Jira são as mesmas cadastradas nas configurações da empresa; aqui você só informa qual projeto/chave usar.
                </p>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={draft.manualCreationDisabled} onChange={(event) => setDraft((current) => ({ ...current, manualCreationDisabled: event.target.checked }))} className="h-4 w-4 accent-(--tc-accent,#ef0001)" />
                  Desabilitar criação manual (usar só integração)
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-full border border-(--tc-border,#d7deea) px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button type="button" onClick={() => void createProject()} disabled={saving} className="rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {saving ? "Salvando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/12 p-4 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
