"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowRight, FiFolder, FiLink, FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";

import { fetchApi } from "@/backend/api";
import { useProjectContext } from "@/context/ProjectContext";

type ProjectItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  qaseProjectCode?: string | null;
  jiraProjectKey?: string | null;
  manualCreationDisabled?: boolean;
};

type Draft = { name: string; slug: string; description: string };

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CompanyProjectsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const companySlug = String(slug ?? "");
  const { refreshProjects, setActiveProject, activeProjectSlug } = useProjectContext();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ name: "", slug: "", description: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    if (!companySlug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchApi(`/api/projects?companySlug=${encodeURIComponent(companySlug)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar os projetos.");
      setProjects(Array.isArray(payload?.projects) ? payload.projects : []);
    } catch (err) {
      setProjects([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar os projetos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProjects(); }, [companySlug]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => [project.name, project.slug, project.description ?? "", project.qaseProjectCode ?? "", project.jiraProjectKey ?? ""].join(" ").toLowerCase().includes(term));
  }, [projects, query]);

  async function createProject() {
    const name = draft.name.trim();
    const projectSlug = normalizeSlug(draft.slug || draft.name);
    if (!name || !projectSlug) {
      setError("Informe o nome do projeto.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetchApi("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companySlug, name, slug: projectSlug, description: draft.description.trim() || undefined, iconKey: "folder" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível criar o projeto.");
      setDraft({ name: "", slug: "", description: "" });
      setCreateOpen(false);
      setMessage("Projeto manual criado. Ele permanecerá manual até ser relacionado ao Qase ou Jira.");
      await loadProjects();
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o projeto.");
    } finally {
      setSaving(false);
    }
  }

  async function openProject(project: ProjectItem) {
    await refreshProjects();
    setActiveProject(project.slug);
    router.push(`/empresas/${companySlug}/dashboard?companySlug=${encodeURIComponent(companySlug)}&projectSlug=${encodeURIComponent(project.slug)}`);
  }

  return (
    <main className="min-h-screen bg-(--page-bg,#f8fafc) px-4 py-6 text-(--page-text,#0b1a3c) sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,#061b45_0%,#0b2b5f_52%,#a20f32_100%)] p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/65">Operação da empresa</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-3xl font-black">Projetos</h1><p className="mt-2 max-w-3xl text-sm text-white/78">Esta é a lista oficial de projetos internos. Qase e Jira são vínculos do mesmo projeto, não registros paralelos.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadProjects()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold"><FiRefreshCw className={loading ? "animate-spin" : ""} />Atualizar</button>
              <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0b1f52]"><FiPlus />Novo projeto manual</button>
            </div>
          </div>
        </section>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

        <section className="rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-black">Projetos da empresa</h2><p className="text-sm text-(--tc-text-muted,#64748b)">{projects.length} projeto{projects.length === 1 ? "" : "s"} cadastrado{projects.length === 1 ? "" : "s"}</p></div>
            <div className="relative w-full md:max-w-md"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto, Qase ou Jira" className="h-11 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-input-bg,#f8fafc) pl-10 pr-4" /></div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <article key={project.id} className={`rounded-2xl border p-5 transition ${activeProjectSlug === project.slug ? "border-[#d91f26] shadow-md" : "border-(--tc-border,#d7deea)"}`}>
                <div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-[#0b1f52]"><FiFolder /></div><span className="rounded-full border px-2.5 py-1 text-[11px] font-bold">{project.manualCreationDisabled ? "Integrado" : "Manual"}</span></div>
                <h3 className="mt-4 text-lg font-black">{project.name}</h3>
                <p className="mt-1 text-sm text-(--tc-text-muted,#64748b)">{project.description || `/${project.slug}`}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${project.qaseProjectCode ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>Qase: {project.qaseProjectCode || "não vinculado"}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${project.jiraProjectKey ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>Jira: {project.jiraProjectKey || "não vinculado"}</span>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => void openProject(project)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0b1f52] px-3 text-sm font-bold text-white">Abrir projeto <FiArrowRight /></button>
                  <button type="button" onClick={() => router.push(`/empresas/${companySlug}/integracoes/${project.qaseProjectCode ? "qase" : "jira"}`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-(--tc-border,#d7deea) px-3 text-sm font-bold"><FiLink />Integrações</button>
                </div>
              </article>
            ))}
          </div>
          {!loading && filtered.length === 0 ? <p className="py-12 text-center text-sm text-(--tc-text-muted,#64748b)">Nenhum projeto encontrado.</p> : null}
        </section>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm"
          onClick={() => setCreateOpen(false)}
          onKeyDown={(event) => event.key === "Escape" && setCreateOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-[26px] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <h2 className="text-2xl font-black text-[#0b1f52]">Novo projeto manual</h2>
            <p className="mt-2 text-sm text-slate-600">O projeto permanecerá manual até ser integrado ao Qase ou Jira.</p>
            <div className="mt-5 grid gap-4">
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, slug: current.slug || normalizeSlug(event.target.value) }))} placeholder="Nome do projeto" className="h-11 rounded-xl border border-slate-200 px-4" />
              <input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: normalizeSlug(event.target.value) }))} placeholder="slug-do-projeto" className="h-11 rounded-xl border border-slate-200 px-4" />
              <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Descrição" className="min-h-28 rounded-xl border border-slate-200 p-4" />
            </div>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setCreateOpen(false)} className="h-10 rounded-xl px-4 text-sm font-bold text-slate-600">Cancelar</button><button type="button" disabled={saving} onClick={() => void createProject()} className="h-10 rounded-xl bg-[#0b1f52] px-5 text-sm font-bold text-white disabled:opacity-50">Criar projeto</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
