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
};

type ProjectDraft = {
  name: string;
  slug: string;
  description: string;
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

  if (route === "casos") return `/casos-de-teste?${params.toString()}`;
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
  const [draft, setDraft] = useState<ProjectDraft>({ name: "", slug: "", description: "" });

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
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Erro ao criar projeto.");
      setCreateOpen(false);
      setDraft({ name: "", slug: "", description: "" });
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
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Projetos</div>
                <div className="mt-1 text-2xl font-black">{activeCount}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Manual</div>
                <div className="mt-1 text-2xl font-black">{manualCount}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Qase</div>
                <div className="mt-1 text-2xl font-black">{qaseCount}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-[-0.03em] text-[var(--tc-text-primary,#0b1a3c)]">Operações disponíveis</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
                Cadastre manualmente ou sincronize com o Qase. Depois entre na operação para controlar qualidade por projeto.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void syncQase()} disabled={syncing} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--tc-text-primary,#0b1a3c)] transition hover:bg-[var(--tc-surface-alt,#f8fafc)] disabled:opacity-60">
                <FiRefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sincronizar Qase
              </button>
              <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,var(--tc-primary,#011848)_0%,var(--tc-accent,#ef0001)_100%)] px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(239,0,1,0.22)] transition hover:-translate-y-0.5 hover:opacity-95">
                <FiPlus className="h-4 w-4" /> Novo projeto
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--tc-text-muted,#6b7280)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, slug ou código Qase" className="h-12 w-full rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10" />
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "Todos"],
                ["manual", "Manuais"],
                ["qase", "Qase"],
              ] as Array<[SourceFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSourceFilter(value)}
                  className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition ${
                    sourceFilter === value
                      ? "border-[var(--tc-primary,#011848)] bg-[var(--tc-primary,#011848)] text-white shadow-[0_10px_20px_rgba(1,24,72,0.16)]"
                      : "border-[var(--tc-border,#d7deea)] bg-white text-[var(--tc-text-secondary,#4b5563)] hover:bg-[var(--tc-surface-alt,#f8fafc)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

          {loading ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-4 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--tc-primary,#011848)]">
                <FiFolder className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-black text-[var(--tc-text-primary,#0b1a3c)]">Nenhum projeto encontrado</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
                Cadastre um projeto manual para iniciar o controle de qualidade ou sincronize com o Qase para trazer os projetos configurados na empresa.
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={() => setCreateOpen(true)} className="rounded-2xl bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-black text-white">Novo projeto</button>
                <button type="button" onClick={() => void syncQase()} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-2 text-sm font-black text-[var(--tc-text-primary,#0b1a3c)]">Sincronizar Qase</button>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {filtered.map((project) => {
                const isActive = activeProjectSlug === project.slug || activeProjectSlug === project.qaseProjectCode;
                return (
                  <article key={makeProjectKey(project)} className={`overflow-hidden rounded-[28px] border bg-[var(--tc-surface-alt,#f8fafc)] shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.09)] ${isActive ? "border-[var(--tc-primary,#011848)] ring-4 ring-blue-950/5" : "border-[var(--tc-border,#d7deea)]"}`}>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--tc-primary,#011848)] shadow-sm">
                            {getProjectSource(project) === "qase" ? <FiLink className="h-5 w-5" /> : <FiFolder className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-xl font-black tracking-[-0.03em] text-[var(--tc-text-primary,#0b1a3c)]">{project.name}</h3>
                              {isActive ? <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-700"><FiCheckCircle /> Ativo</span> : null}
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">/{project.slug}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${sourceClass(project)}`}>
                          {sourceLabel(project)}
                        </span>
                      </div>

                      <p className="mt-4 min-h-12 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
                        {project.description || "Operação de qualidade pronta para receber casos, defeitos, planos, runs, documentos e métricas do projeto."}
                      </p>

                      <div className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#64748b)]">Módulos da operação</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {OPERATION_MODULES.map((module) => {
                            const Icon = module.icon;
                            return (
                              <button
                                key={module.id}
                                type="button"
                                onClick={() => void openOperation(project, module.id)}
                                className="group rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-3 py-2 text-left transition hover:border-[var(--tc-primary,#011848)] hover:bg-white"
                              >
                                <div className="flex items-center gap-2 text-xs font-black text-[var(--tc-text-primary,#0b1a3c)]">
                                  <Icon className="h-3.5 w-3.5 text-[var(--tc-accent,#ef0001)]" />
                                  {module.label}
                                </div>
                                <div className="mt-1 truncate text-[10px] font-semibold text-[var(--tc-text-muted,#64748b)]">{module.description}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-[var(--tc-border,#d7deea)] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-semibold leading-5 text-[var(--tc-text-secondary,#4b5563)]">
                        Escopo: <strong>{companySlug}</strong> + <strong>{project.slug}</strong>
                      </div>
                      <button type="button" onClick={() => void openOperation(project, "dashboard")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--tc-primary,#011848)] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:opacity-90">
                        Abrir operação <FiArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-[var(--tc-border,#d7deea)] bg-white shadow-[0_34px_100px_rgba(15,23,42,0.34)]" onClick={(event) => event.stopPropagation()}>
            <div className="bg-[linear-gradient(135deg,#011848_0%,#102f6e_70%,#ef0001_150%)] px-6 py-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">Cadastro manual</p>
              <h2 className="mt-1 text-2xl font-black">Novo projeto</h2>
              <p className="mt-1 text-sm leading-6 text-white/72">
                Crie uma operação manual para empresas sem Qase ou para aplicações que precisam de controle próprio dentro da qualidade.
              </p>
            </div>
            <div className="space-y-4 p-6">
              <label className="block text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)]">
                Nome do projeto
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: current.slug || normalizeSlug(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-[var(--tc-border,#d7deea)] px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  placeholder="Ex.: Cidadão Smart"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)]">
                Slug operacional
                <input
                  value={draft.slug}
                  onChange={(event) => setDraft((current) => ({ ...current, slug: normalizeSlug(event.target.value) }))}
                  className="mt-1 w-full rounded-2xl border border-[var(--tc-border,#d7deea)] px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  placeholder="cidadao-smart"
                />
                <span className="mt-1 block text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">
                  Usado para filtrar dashboard, casos, defeitos, planos e runs do projeto.
                </span>
              </label>
              <label className="block text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)]">
                Descrição
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-[var(--tc-border,#d7deea)] px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  rows={4}
                  placeholder="Resumo operacional do projeto"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--tc-border,#d7deea)] px-6 py-4">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-2xl border border-[var(--tc-border,#d7deea)] px-4 py-2 text-sm font-bold">
                Cancelar
              </button>
              <button type="button" onClick={() => void createProject()} disabled={saving} className="rounded-2xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar projeto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}


