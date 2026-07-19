"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiExternalLink, FiLink, FiPlus, FiRefreshCw, FiSettings } from "react-icons/fi";

import { fetchApi } from "@/backend/api";

type Provider = "qase" | "jira";
type Project = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
  jiraProjectKey?: string | null;
  manualCreationDisabled?: boolean;
};
type ExternalProject = { key: string; name: string; linkedProject?: Project | null };
type Payload = {
  provider: Provider;
  company: { id: string; name: string; slug: string; configured: boolean };
  projects: Project[];
  externalProjects: ExternalProject[];
};

export default function CompanyIntegrationsClient({ companySlug, provider }: { companySlug: string; provider: Provider }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedExternal, setSelectedExternal] = useState<ExternalProject | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [qaseToken, setQaseToken] = useState("");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");

  const title = provider === "qase" ? "Qase" : "Jira";
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchApi(`/api/company-integrations/${encodeURIComponent(companySlug)}?provider=${provider}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Não foi possível carregar ${title}.`);
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : `Não foi possível carregar ${title}.`);
    } finally {
      setLoading(false);
    }
  }, [companySlug, provider, title]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelectedExternal(null); setSelectedProjectId(""); setMessage(null); setError(null); }, [provider]);

  const availableProjects = useMemo(() => data?.projects ?? [], [data]);

  async function saveConfiguration() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body = provider === "qase"
        ? { provider, token: qaseToken }
        : { provider, baseUrl: jiraBaseUrl, email: jiraEmail, token: jiraToken };
      const response = await fetchApi(`/api/company-integrations/${encodeURIComponent(companySlug)}/configuration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar a integração.");
      setMessage(`${title} configurado e validado com sucesso.`);
      setQaseToken("");
      setJiraToken("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a integração.");
    } finally {
      setSaving(false);
    }
  }

  async function linkProject(createProject: boolean) {
    if (!selectedExternal) return;
    if (!createProject && !selectedProjectId) {
      setError("Selecione um projeto interno ou escolha criar um novo projeto.");
      return;
    }
    if (provider === "qase") {
      const confirmed = window.confirm(
        "Este projeto passará a usar o repositório integrado do Qase. O conteúdo operacional deverá ser sincronizado com o projeto selecionado e a criação manual independente ficará desativada. Deseja continuar?",
      );
      if (!confirmed) return;
    }
    const external = selectedExternal;

    async function submitLink(forceReplace: boolean): Promise<void> {
      const response = await fetchApi(`/api/company-integrations/${encodeURIComponent(companySlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          externalKey: external.key,
          externalName: external.name,
          projectId: createProject ? undefined : selectedProjectId,
          createProject,
          confirmIntegratedRepository: provider === "qase",
          forceReplace,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok) return;

      if (!forceReplace && payload?.code === "EXTERNAL_LINK_REPLACEMENT_REQUIRES_CONFIRMATION" && window.confirm(`${payload.error} Deseja substituir o vínculo?`)) {
        return submitLink(true);
      }

      throw new Error(payload?.error || "Não foi possível relacionar o projeto.");
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await submitLink(false);
      setMessage(createProject ? "Projeto criado e integrado com sucesso." : "Projeto relacionado com sucesso.");
      setSelectedExternal(null);
      setSelectedProjectId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível relacionar o projeto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-(--page-bg,#f8fafc) px-4 py-6 text-(--page-text,#0b1a3c) sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,#061b45_0%,#0b2b5f_52%,#a20f32_100%)] p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/65">Integrações da empresa</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/78">
                A empresa guarda as credenciais. Cada projeto interno guarda apenas o código do Qase ou a chave do Jira correspondente.
              </p>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold hover:bg-white/15 disabled:opacity-60">
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
          </div>
        </section>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><FiCheckCircle className="mr-2 inline" />{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

        <section className="rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
          <div className="flex items-center gap-3"><FiSettings /><div><h2 className="text-xl font-black">Configuração</h2><p className="text-sm text-(--tc-text-muted,#64748b)">As credenciais ficam salvas na empresa e são reutilizadas por todos os projetos relacionados.</p></div></div>
          {provider === "qase" ? (
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
              <input type="password" value={qaseToken} onChange={(event) => setQaseToken(event.target.value)} placeholder={data?.company.configured ? "Informe um novo token para substituir o atual" : "Token da API do Qase"} className="h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-input-bg,#f8fafc) px-4" />
              <button type="button" disabled={saving || !qaseToken.trim()} onClick={() => void saveConfiguration()} className="h-11 rounded-xl bg-[#0b1f52] px-5 text-sm font-bold text-white disabled:opacity-50">Validar e salvar</button>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input value={jiraBaseUrl} onChange={(event) => setJiraBaseUrl(event.target.value)} placeholder="https://empresa.atlassian.net" className="h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-input-bg,#f8fafc) px-4" />
              <input value={jiraEmail} onChange={(event) => setJiraEmail(event.target.value)} placeholder="E-mail técnico" className="h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-input-bg,#f8fafc) px-4" />
              <input type="password" value={jiraToken} onChange={(event) => setJiraToken(event.target.value)} placeholder={data?.company.configured ? "Novo API token para substituir o atual" : "API token do Jira"} className="h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-input-bg,#f8fafc) px-4" />
              <button type="button" disabled={saving || !jiraBaseUrl.trim() || !jiraEmail.trim() || !jiraToken.trim()} onClick={() => void saveConfiguration()} className="h-11 rounded-xl bg-[#0b1f52] px-5 text-sm font-bold text-white disabled:opacity-50">Validar e salvar</button>
            </div>
          )}
        </section>

        <section className="rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Projetos encontrados</h2><p className="text-sm text-(--tc-text-muted,#64748b)">Crie um projeto interno ou relacione a um projeto já existente.</p></div><span className="rounded-full border px-3 py-1 text-xs font-bold">{data?.externalProjects.length ?? 0}</span></div>
          {loading ? <p className="py-10 text-center text-sm text-(--tc-text-muted,#64748b)">Carregando projetos...</p> : null}
          {!loading && data && !data.company.configured ? <p className="py-10 text-center text-sm text-(--tc-text-muted,#64748b)">Configure e valide o {title} para buscar os projetos disponíveis.</p> : null}
          <div className="mt-4 grid gap-3">
            {data?.externalProjects.map((external) => (
              <div key={external.key} className="rounded-2xl border border-(--tc-border,#d7deea) p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><strong>{external.name}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{external.key}</span></div>{external.linkedProject ? <p className="mt-1 text-xs font-bold text-emerald-700">Vinculado a {external.linkedProject.name}</p> : <p className="mt-1 text-xs text-(--tc-text-muted,#64748b)">Ainda não relacionado.</p>}</div>
                  {!external.linkedProject ? <button type="button" onClick={() => { setSelectedExternal(external); setSelectedProjectId(""); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-(--tc-border,#d7deea) px-4 text-sm font-bold"><FiLink /> Relacionar</button> : <FiExternalLink className="text-emerald-600" />}
                </div>
                {selectedExternal?.key === external.key ? (
                  <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto]">
                    <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3"><option value="">Selecione um projeto existente</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
                    <button type="button" disabled={saving || !selectedProjectId} onClick={() => void linkProject(false)} className="h-11 rounded-xl bg-[#0b1f52] px-4 text-sm font-bold text-white disabled:opacity-50"><FiLink className="mr-2 inline" />Vincular</button>
                    <button type="button" disabled={saving} onClick={() => void linkProject(true)} className="h-11 rounded-xl border border-[#d91f26] px-4 text-sm font-bold text-[#b5122a]"><FiPlus className="mr-2 inline" />Criar novo projeto</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
