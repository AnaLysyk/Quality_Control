"use client";

import { FormEvent, useEffect, useState } from "react";

type BrainSource = {
  id: string;
  name: string;
  description?: string | null;
  sourceType: string;
  provider?: string | null;
  status: string;
  scopeType: string;
  companySlug?: string | null;
  projectSlug?: string | null;
  environment: string;
  priority: number;
  useForCompanyContext: boolean;
  useForGeneralQuestions: boolean;
  useForRagIngestion: boolean;
  useForLiveQuery: boolean;
  config?: Record<string, unknown>;
  secrets?: Array<{ key: string; maskedValue: string; label?: string | null }>;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
};

type AuditItem = {
  id: string;
  action: string;
  sourceId?: string | null;
  userId?: string | null;
  createdAt: string;
};

const SOURCE_TYPES = [
  ["external_api", "API externa"],
  ["external_database", "Banco externo"],
  ["public_site", "Site/documentacao publica"],
  ["free_web", "Web livre controlada"],
  ["internal_wiki", "Wiki/documentacao interna"],
  ["file_document", "Arquivo/documento"],
  ["webhook", "Webhook"],
  ["internal_system", "Fonte interna"],
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha na requisicao");
  return json as T;
}

function dateLabel(value?: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function BrainSourcesSettings() {
  const [sources, setSources] = useState<BrainSource[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requiresMigration, setRequiresMigration] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    sourceType: "external_api",
    provider: "",
    status: "draft",
    scopeType: "global",
    companySlug: "",
    projectSlug: "",
    environment: "dev",
    baseUrl: "",
    authType: "none",
    apiKeyName: "",
    apiKeyLocation: "header",
    token: "",
    username: "",
    password: "",
    oauthClientId: "",
    oauthClientSecret: "",
    oauthAuthUrl: "",
    oauthTokenUrl: "",
    oauthRedirectUri: "",
    oauthScopes: "",
    dbType: "postgres",
    host: "",
    port: "",
    databaseName: "",
    schemaName: "",
    connectionString: "",
    sslMode: "require",
    allowedDomains: "",
    startUrls: "",
    crawlDepth: "1",
    maxPages: "25",
    useForCompanyContext: false,
    useForGeneralQuestions: true,
    useForRagIngestion: false,
    useForLiveQuery: false,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [sourceData, auditData] = await Promise.all([
        fetchJson<{ sources: BrainSource[]; requiresMigration?: boolean; error?: string }>("/api/brain/settings/sources"),
        fetchJson<{ audit: AuditItem[] }>("/api/brain/settings/audit?limit=40").catch(() => ({ audit: [] })),
      ]);
      setSources(sourceData.sources ?? []);
      setRequiresMigration(sourceData.requiresMigration === true);
      if (sourceData.requiresMigration && sourceData.error) setError(sourceData.error);
      setAudit(auditData.audit ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fontes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(source: BrainSource) {
    const api = (source.config?.api ?? {}) as Record<string, unknown>;
    const database = (source.config?.database ?? {}) as Record<string, unknown>;
    const web = (source.config?.web ?? {}) as Record<string, unknown>;
    setEditingId(source.id);
    setForm((current) => ({
      ...current,
      name: source.name,
      description: source.description ?? "",
      sourceType: source.sourceType,
      provider: source.provider ?? "",
      status: source.status,
      scopeType: source.scopeType,
      companySlug: source.companySlug ?? "",
      projectSlug: source.projectSlug ?? "",
      environment: source.environment,
      baseUrl: String(api.baseUrl ?? web.baseUrl ?? ""),
      authType: String(api.authType ?? "none"),
      apiKeyName: String(api.apiKeyName ?? ""),
      apiKeyLocation: String(api.apiKeyLocation ?? "header"),
      oauthClientId: String(api.oauthClientId ?? ""),
      oauthAuthUrl: String(api.oauthAuthUrl ?? ""),
      oauthTokenUrl: String(api.oauthTokenUrl ?? ""),
      oauthRedirectUri: String(api.oauthRedirectUri ?? ""),
      oauthScopes: Array.isArray(api.oauthScopes) ? api.oauthScopes.join(", ") : "",
      dbType: String(database.dbType ?? "postgres"),
      host: String(database.host ?? ""),
      port: String(database.port ?? ""),
      databaseName: String(database.databaseName ?? ""),
      schemaName: String(database.schemaName ?? ""),
      sslMode: String(database.sslMode ?? "require"),
      allowedDomains: Array.isArray(web.allowedDomains) ? web.allowedDomains.join(", ") : "",
      startUrls: Array.isArray(web.startUrls) ? web.startUrls.join(", ") : "",
      crawlDepth: String(web.crawlDepth ?? "1"),
      maxPages: String(web.maxPages ?? "25"),
      token: "",
      username: "",
      password: "",
      oauthClientSecret: "",
      connectionString: "",
      useForCompanyContext: source.useForCompanyContext,
      useForGeneralQuestions: source.useForGeneralQuestions,
      useForRagIngestion: source.useForRagIngestion,
      useForLiveQuery: source.useForLiveQuery,
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm((current) => ({
      ...current,
      name: "",
      description: "",
      provider: "",
      baseUrl: "",
      token: "",
      username: "",
      password: "",
      oauthClientSecret: "",
      connectionString: "",
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payload = {
        ...form,
        port: form.port ? Number(form.port) : undefined,
        crawlDepth: Number(form.crawlDepth),
        maxPages: Number(form.maxPages),
        oauthScopes: form.oauthScopes,
        allowedDomains: form.allowedDomains,
        startUrls: form.startUrls,
        secretValues: {
          ...(form.token ? { token: form.token } : {}),
          ...(form.username ? { username: form.username } : {}),
          ...(form.password ? { password: form.password } : {}),
          ...(form.oauthClientSecret ? { oauthClientSecret: form.oauthClientSecret } : {}),
          ...(form.connectionString ? { connectionString: form.connectionString } : {}),
        },
      };
      if (editingId) {
        await fetchJson(`/api/brain/settings/sources/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setFeedback("Fonte atualizada.");
      } else {
        await fetchJson("/api/brain/settings/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setFeedback("Fonte criada.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar fonte");
    } finally {
      setSaving(false);
    }
  }

  async function sourceAction(source: BrainSource, action: "enable" | "disable" | "test") {
    setError(null);
    setFeedback(null);
    try {
      const data = await fetchJson<{ result?: { message?: string } }>(`/api/brain/settings/sources/${encodeURIComponent(source.id)}/${action}`, { method: "POST" });
      setFeedback(action === "test" ? `Teste concluido: ${data.result?.message ?? "ok"}` : action === "enable" ? "Fonte ativada." : "Fonte desativada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na acao da fonte");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100">
      <section className="mx-auto grid max-w-7xl gap-5">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/70">Brain</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Configurações do Brain</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Configure fontes de API, banco, site, wiki, webhook e web livre controlada. Segredos ficam no backend e aparecem apenas mascarados.
            </p>
          </div>
          <button type="button" onClick={load} className="rounded-lg border border-cyan-200/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-200/10">
            Atualizar
          </button>
        </header>

        {requiresMigration ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            A migration de fontes do Brain ainda precisa ser aplicada para persistir configuracoes.
          </p>
        ) : null}
        {error ? <p className="rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        {feedback ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</p> : null}

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <section className="grid gap-3">
            {loading ? <p className="rounded-lg border border-white/10 p-5 text-sm text-slate-300">Carregando fontes...</p> : null}
            {!loading && !sources.length ? <p className="rounded-lg border border-dashed border-white/15 p-5 text-sm text-slate-300">Nenhuma fonte cadastrada neste escopo.</p> : null}
            {sources.map((source) => (
              <article key={source.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">{source.sourceType}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">{source.status}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">{source.scopeType}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-black">{source.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{source.description || "Sem descricao."}</p>
                    <div className="mt-3 grid gap-1 text-xs text-slate-400">
                      <span>Provider: {source.provider || "nao informado"} · Ambiente: {source.environment}</span>
                      <span>Empresa: {source.companySlug || "global/nao informado"} · Projeto: {source.projectSlug || "todos"}</span>
                      <span>Ultimo sucesso: {dateLabel(source.lastSuccessAt)} · Ultimo erro: {source.lastErrorMessage || "nenhum"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {source.secrets?.map((secret) => (
                        <span key={secret.key} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300">
                          {secret.label ?? secret.key}: {secret.maskedValue}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => edit(source)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/10">Editar</button>
                    <button type="button" onClick={() => sourceAction(source, "test")} className="rounded-lg border border-cyan-200/30 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-200/10">Testar</button>
                    <button type="button" onClick={() => sourceAction(source, source.status === "active" ? "disable" : "enable")} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/10">
                      {source.status === "active" ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <aside className="space-y-4">
            <form onSubmit={submit} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-lg font-black">{editingId ? "Editar fonte" : "Nova fonte"}</h2>
              <div className="mt-4 grid gap-3">
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descricao" rows={3} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                    {SOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativa</option>
                    <option value="inactive">Inativa</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.scopeType} onChange={(event) => setForm((current) => ({ ...current, scopeType: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                    <option value="global">Global</option>
                    <option value="company">Empresa</option>
                    <option value="project">Projeto</option>
                    <option value="user">Usuario</option>
                  </select>
                  <select value={form.environment} onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                    <option value="production">Producao</option>
                    <option value="staging">Staging</option>
                    <option value="homolog">Homolog</option>
                    <option value="dev">Dev</option>
                  </select>
                </div>
                <input value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} placeholder="Provider" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.companySlug} onChange={(event) => setForm((current) => ({ ...current, companySlug: event.target.value }))} placeholder="companySlug" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                  <input value={form.projectSlug} onChange={(event) => setForm((current) => ({ ...current, projectSlug: event.target.value }))} placeholder="projectSlug" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                </div>

                <div className="rounded-lg border border-white/10 p-3">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">API / Web</p>
                  <input value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="baseUrl / health URL" className="mb-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={form.authType} onChange={(event) => setForm((current) => ({ ...current, authType: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                      {["none", "apiKey", "bearer", "basic", "oauth2", "openIdConnect", "customHeader"].map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input value={form.apiKeyName} onChange={(event) => setForm((current) => ({ ...current, apiKeyName: event.target.value }))} placeholder="apiKeyName" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 p-3">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Banco externo</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={form.dbType} onChange={(event) => setForm((current) => ({ ...current, dbType: event.target.value }))} placeholder="dbType" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                    <input value={form.host} onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))} placeholder="host" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                    <input value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} placeholder="porta" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                    <input value={form.databaseName} onChange={(event) => setForm((current) => ({ ...current, databaseName: event.target.value }))} placeholder="database" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 p-3">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Segredos</p>
                  <input value={form.token} onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))} type="password" placeholder="token/api key/bearer" className="mb-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="usuario/basic" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                    <input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} type="password" placeholder="senha/basic" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                  </div>
                  <input value={form.connectionString} onChange={(event) => setForm((current) => ({ ...current, connectionString: event.target.value }))} type="password" placeholder="connection string" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                </div>

                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useForCompanyContext} onChange={(event) => setForm((current) => ({ ...current, useForCompanyContext: event.target.checked }))} /> Usar para contexto da empresa</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useForGeneralQuestions} onChange={(event) => setForm((current) => ({ ...current, useForGeneralQuestions: event.target.checked }))} /> Usar para perguntas gerais</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useForRagIngestion} onChange={(event) => setForm((current) => ({ ...current, useForRagIngestion: event.target.checked }))} /> Usar em ingestao RAG</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useForLiveQuery} onChange={(event) => setForm((current) => ({ ...current, useForLiveQuery: event.target.checked }))} /> Usar em consulta viva</label>

                <button disabled={saving || requiresMigration} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{saving ? "Salvando..." : editingId ? "Salvar fonte" : "Criar fonte"}</button>
                {editingId ? <button type="button" onClick={resetForm} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold">Cancelar edicao</button> : null}
              </div>
            </form>

            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-300">Auditoria</h2>
              <div className="mt-3 grid gap-2">
                {audit.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg bg-black/20 p-3 text-xs text-slate-300">
                    <p className="font-black text-white">{item.action}</p>
                    <p className="mt-1">{item.sourceId ?? "sem fonte"} · {dateLabel(item.createdAt)}</p>
                  </div>
                ))}
                {!audit.length ? <p className="text-sm text-slate-400">Sem auditoria visivel.</p> : null}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
