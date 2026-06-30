"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiFolder, FiLink, FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
import { fetchApi } from "@/lib/api";
import { useProjectContext } from "@/lib/core/project/ProjectContext";

type ProjectItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status?: string | null;
  source?: string | null;
  qaseProjectCode?: string | null;
  createdAt?: string | null;
};

type ProjectDraft = {
  name: string;
  slug: string;
  description: string;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sourceLabel(project: ProjectItem) {
  const source = String(project.source ?? "manual").toLowerCase();
  if (source === "qase" || project.qaseProjectCode) return `Qase${project.qaseProjectCode ? `: ${project.qaseProjectCode}` : ""}`;
  return "Manual";
}

function sourceClass(project: ProjectItem) {
  const source = String(project.source ?? "manual").toLowerCase();
  if (source === "qase" || project.qaseProjectCode) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export default function CompanyProjectsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { refreshProjects } = useProjectContext();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>({ name: "", slug: "", description: "" });

  const companySlug = String(slug ?? "");

  async function loadProjects() {
    if (!companySlug) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, appRes] = await Promise.all([
        fetchApi(`/api/projects?companySlug=${encodeURIComponent(companySlug)}`),
        fetchApi(`/api/applications?companySlug=${encodeURIComponent(companySlug)}`),
      ]);
      const projectJson = await projectRes.json().catch(() => null);
      const appJson = await appRes.json().catch(() => null);
      const manualProjects = Array.isArray(projectJson?.projects) ? projectJson.projects : [];
      const applicationProjects = Array.isArray(appJson?.items)
        ? appJson.items.map((item: ProjectItem) => ({
            ...item,
            source: item.source ?? (item.qaseProjectCode ? "qase" : "manual"),
          }))
        : [];
      const merged = new Map<string, ProjectItem>();
      [...manualProjects, ...applicationProjects].forEach((item) => {
        const key = item.qaseProjectCode ? `qase:${item.qaseProjectCode}` : item.slug;
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
    }
  }

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySlug]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) =>
      [project.name, project.slug, project.description ?? "", project.qaseProjectCode ?? "", project.source ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [projects, query]);

  const manualCount = projects.filter((project) => !project.qaseProjectCode && String(project.source ?? "manual").toLowerCase() !== "qase").length;
  const qaseCount = projects.filter((project) => project.qaseProjectCode || String(project.source ?? "").toLowerCase() === "qase").length;

  function openCreate() {
    setDraft({ name: "", slug: "", description: "" });
    setCreateOpen(true);
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
      await loadProjects();
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

        <section className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,#011848_0%,#082457_42%,#4b0f2f_76%,#ef0001_100%)] px-6 py-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Operacional da empresa</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Projetos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/82">
                Tela antiga de aplicações reorganizada como projetos. Pode listar projetos cadastrados manualmente ou projetos integrados pelo Qase.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiFolder className="h-4 w-4" /> {projects.length} projetos
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                Manual: {manualCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                Qase: {qaseCount}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, slug ou código Qase"
                className="h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadProjects()}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-(--tc-text-primary,#0b1a3c) transition hover:bg-(--tc-surface-alt,#f8fafc)"
              >
                <FiRefreshCw className="h-4 w-4" /> Sincronizar Qase
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,var(--tc-primary,#011848)_0%,var(--tc-accent,#ef0001)_100%)] px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(239,0,1,0.22)] transition hover:-translate-y-0.5 hover:opacity-95"
              >
                <FiPlus className="h-4 w-4" /> Novo projeto
              </button>
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

          {loading ? (
            <div className="mt-5 rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-10 text-center text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
              Carregando projetos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-10 text-center text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
              Nenhum projeto encontrado. Cadastre manualmente ou configure a integração Qase na empresa.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <article key={`${project.source ?? "manual"}-${project.id}`} className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-(--tc-primary,#011848)">
                        {project.qaseProjectCode ? <FiLink className="h-5 w-5" /> : <FiFolder className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-black text-(--tc-text-primary,#0b1a3c)">{project.name}</h2>
                        <p className="mt-1 text-xs font-semibold text-(--tc-text-muted,#64748b)">/{project.slug}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${sourceClass(project)}`}>
                      {sourceLabel(project)}
                    </span>
                  </div>
                  <p className="mt-4 min-h-12 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                    {project.description || "Sem descrição operacional cadastrada."}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-2xl rounded-4xl border border-(--tc-border,#d7deea) bg-white shadow-[0_34px_100px_rgba(15,23,42,0.34)]" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-(--tc-border,#d7deea) px-6 py-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-(--tc-accent,#ef0001)">Cadastro manual</p>
              <h2 className="mt-1 text-2xl font-black text-(--tc-text-primary,#0b1a3c)">Novo projeto</h2>
              <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                Use este fluxo para empresas sem Qase ou para projetos que precisam existir manualmente no operacional.
              </p>
            </div>
            <div className="space-y-4 p-6">
              <label className="block text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
                Nome
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: current.slug || normalizeSlug(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  placeholder="Ex.: Cidadão Smart"
                />
              </label>
              <label className="block text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
                Slug
                <input
                  value={draft.slug}
                  onChange={(event) => setDraft((current) => ({ ...current, slug: normalizeSlug(event.target.value) }))}
                  className="mt-1 w-full rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  placeholder="cidadao-smart"
                />
              </label>
              <label className="block text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
                Descrição
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  rows={4}
                  placeholder="Resumo operacional do projeto"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-(--tc-border,#d7deea) px-6 py-4">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-2xl border border-(--tc-border,#d7deea) px-4 py-2 text-sm font-bold">
                Cancelar
              </button>
              <button type="button" onClick={() => void createProject()} disabled={saving} className="rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar projeto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
