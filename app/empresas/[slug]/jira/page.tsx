"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiExternalLink, FiLink, FiRefreshCw, FiSearch } from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
import { fetchApi } from "@/lib/api";
import { useProjectContext } from "@/context/ProjectContext";

type JiraIssue = {
  id: string;
  key: string;
  summary: string | null;
  status: string | null;
  assignee: string | null;
  created: string | null;
};

type TestCaseOption = {
  id: string;
  key: string;
  title: string;
};

export default function CompanyJiraTicketsPage() {
  const { slug } = useParams<{ slug: string }>();
  const companySlug = String(slug ?? "");
  const { activeProject, loading: loadingProject } = useProjectContext();

  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [linkingIssue, setLinkingIssue] = useState<JiraIssue | null>(null);
  const [caseQuery, setCaseQuery] = useState("");
  const [caseOptions, setCaseOptions] = useState<TestCaseOption[]>([]);
  const [searchingCases, setSearchingCases] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function loadIssues() {
    if (!activeProject?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchApi(`/api/projects/${encodeURIComponent(activeProject.id)}/jira-tickets`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Não foi possível carregar os tickets do Jira.");
      setIssues(Array.isArray(payload?.issues) ? payload.issues : []);
      setBaseUrl(payload?.baseUrl ?? null);
    } catch (err) {
      setIssues([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar os tickets do Jira.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeProject?.jiraProjectKey) void loadIssues();
    else {
      setIssues([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, activeProject?.jiraProjectKey]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return issues;
    return issues.filter((issue) =>
      [issue.key, issue.summary ?? "", issue.status ?? "", issue.assignee ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [issues, query]);

  function issueUrl(issue: JiraIssue) {
    return baseUrl ? `${baseUrl}/browse/${issue.key}` : null;
  }

  function openLinkModal(issue: JiraIssue) {
    setLinkingIssue(issue);
    setCaseQuery("");
    setCaseOptions([]);
    setLinkError(null);
  }

  useEffect(() => {
    if (!linkingIssue) return;
    const term = caseQuery.trim();
    if (!term) {
      setCaseOptions([]);
      return;
    }
    let canceled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchingCases(true);
      try {
        const params = new URLSearchParams({ companySlug, query: term });
        if (activeProject?.id) params.set("projectId", activeProject.id);
        const response = await fetchApi(`/api/test-cases?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!canceled) {
          const items = Array.isArray(payload?.items) ? payload.items : [];
          setCaseOptions(
            items.map((item: { testCase: { id: string; key: string; title: string } }) => ({
              id: item.testCase.id,
              key: item.testCase.key,
              title: item.testCase.title,
            })),
          );
        }
      } catch {
        if (!canceled) setCaseOptions([]);
      } finally {
        if (!canceled) setSearchingCases(false);
      }
    }, 300);
    return () => {
      canceled = true;
      window.clearTimeout(timeoutId);
    };
  }, [caseQuery, linkingIssue, companySlug, activeProject?.id]);

  async function linkIssueToCase(testCaseId: string) {
    if (!linkingIssue) return;
    setLinkSaving(true);
    setLinkError(null);
    try {
      const response = await fetchApi(`/api/test-cases/${encodeURIComponent(testCaseId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalKey: linkingIssue.key,
          externalUrl: issueUrl(linkingIssue) ?? undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Não foi possível vincular o ticket ao caso.");
      }
      setLinkingIssue(null);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Não foi possível vincular o ticket ao caso.");
    } finally {
      setLinkSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-(--page-bg,#f8fafc) px-3 py-4 text-(--page-text,#0b1a3c) sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-350 flex-col gap-5">
        <Breadcrumb items={[{ label: "Empresa", href: `/empresas/${companySlug}/dashboard` }, { label: "Jira" }]} />

        <section data-testid="jira-tickets-page" className="rounded-[30px] border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Tickets do Jira</h1>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                {activeProject ? `Projeto: ${activeProject.name}` : "Selecione um projeto para ver os tickets."}
                {activeProject?.jiraProjectKey ? ` · Jira: ${activeProject.jiraProjectKey}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadIssues()}
              disabled={loading || !activeProject?.jiraProjectKey}
              className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
          </div>

          {loadingProject ? (
            <p className="mt-5 text-sm text-(--tc-text-secondary,#4b5563)">Carregando contexto do projeto...</p>
          ) : !activeProject ? (
            <p className="mt-5 rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
              Nenhum projeto ativo. Selecione um projeto no menu para ver os tickets do Jira.
            </p>
          ) : !activeProject.jiraProjectKey ? (
            <p className="mt-5 rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
              Este projeto ainda não tem uma chave do Jira configurada. Configure em Empresa → Projetos.
            </p>
          ) : (
            <>
              <label className="relative mt-5 block max-w-md">
                <FiSearch className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por chave, resumo, status ou responsável"
                  className="min-h-11 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white pr-4 pl-11 text-sm outline-none"
                />
              </label>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
              ) : null}

              <div data-testid="jira-tickets-list" className="mt-5 grid gap-3">
                {loading ? <p className="text-sm text-(--tc-text-secondary,#4b5563)">Carregando tickets...</p> : null}
                {!loading && filtered.length === 0 && !error ? (
                  <p className="rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
                    Nenhum ticket encontrado.
                  </p>
                ) : null}
                {filtered.map((issue) => {
                  const url = issueUrl(issue);
                  return (
                    <article key={issue.id} data-testid="jira-ticket-card" className="flex flex-col gap-3 rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-(--tc-accent,#ef0001)">{issue.key}</span>
                          {issue.status ? <span className="rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-0.5 text-[11px] font-bold">{issue.status}</span> : null}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{issue.summary || "Sem resumo"}</p>
                        <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{issue.assignee ? `Responsável: ${issue.assignee}` : "Sem responsável"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-xs font-bold">
                            <FiExternalLink /> Abrir
                          </a>
                        ) : null}
                        <button
                          type="button"
                          data-testid="jira-ticket-link-button"
                          onClick={() => openLinkModal(issue)}
                          className="inline-flex items-center gap-2 rounded-full bg-(--tc-primary,#011848) px-3 py-2 text-xs font-bold text-white"
                        >
                          <FiLink /> Vincular a caso
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {linkingIssue ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div data-testid="jira-link-modal" className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Vincular ticket</p>
                <h3 className="mt-1 text-xl font-black tracking-tight">{linkingIssue.key} — {linkingIssue.summary || "Sem resumo"}</h3>
              </div>
              <button type="button" onClick={() => setLinkingIssue(null)} className="rounded-full border border-(--tc-border,#d7deea) px-3 py-1 text-sm font-bold">×</button>
            </div>

            <label className="relative mt-5 block">
              <FiSearch className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
              <input
                autoFocus
                value={caseQuery}
                onChange={(event) => setCaseQuery(event.target.value)}
                placeholder="Buscar caso de teste por título ou código"
                className="min-h-11 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white pr-4 pl-11 text-sm outline-none"
              />
            </label>

            {linkError ? <p className="mt-3 text-sm font-semibold text-rose-700">{linkError}</p> : null}

            <div className="mt-3 grid max-h-72 gap-2 overflow-auto">
              {searchingCases ? <p className="text-sm text-(--tc-text-secondary,#4b5563)">Buscando...</p> : null}
              {!searchingCases && caseQuery.trim() && caseOptions.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum caso encontrado.</p>
              ) : null}
              {caseOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={linkSaving}
                  onClick={() => void linkIssueToCase(option.id)}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-left text-sm font-semibold hover:border-(--tc-accent,#ef0001) disabled:opacity-60"
                >
                  <span className="truncate">{option.title}</span>
                  <span className="shrink-0 text-xs font-bold text-(--tc-text-muted,#6b7280)">{option.key}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
