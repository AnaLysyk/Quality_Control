"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiCode, FiExternalLink, FiGitPullRequest, FiInbox, FiX } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

type QueueTestCase = {
  id: string;
  key?: string;
  title: string;
  priority: string;
  suiteName?: string | null;
  automationStatus: string;
};

type QueueDraft = {
  id: string;
  testCaseId: string;
  status: "draft" | "approved" | "linked" | "discarded";
  specFile?: string | null;
  specCode?: string | null;
  updatedAt: string;
  githubPublication?: {
    status: "pending" | "published" | "failed";
    pullRequestUrl?: string | null;
  } | null;
};

type QueueItem = { testCase: QueueTestCase; draft: QueueDraft | null };

type QueueResponse = {
  backlog: QueueItem[];
  inProgress: QueueItem[];
  automated: QueueItem[];
};

type TestCaseStep = {
  id: string;
  order: number;
  action: string;
  expectedResult: string;
};

type TestCaseDetail = {
  testCase: { id: string; title: string; objective?: string | null; description?: string | null };
  steps: TestCaseStep[];
};

type Props = {
  activeCompanySlug: string | null;
};

type TabId = "backlog" | "inProgress" | "automated";

const TABS: { id: TabId; label: string; icon: typeof FiInbox }[] = [
  { id: "backlog", label: "A automatizar", icon: FiInbox },
  { id: "inProgress", label: "Em desenvolvimento", icon: FiClock },
  { id: "automated", label: "Automatizados", icon: FiCheckCircle },
];

export default function AutomationQueueBoard({ activeCompanySlug }: Props) {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("backlog");
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [detail, setDetail] = useState<TestCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let canceled = false;
    async function load() {
      if (!activeCompanySlug) {
        setData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await fetchApi(`/api/automations/queue?companySlug=${encodeURIComponent(activeCompanySlug)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (!canceled) {
          setData(null);
          setLoading(false);
        }
        return;
      }
      const payload = (await response.json()) as QueueResponse;
      if (!canceled) {
        setData(payload);
        setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [activeCompanySlug]);

  useEffect(() => {
    let canceled = false;
    async function loadDetail() {
      if (!selected) {
        setDetail(null);
        return;
      }
      setDetailLoading(true);
      const response = await fetchApi(`/api/test-cases/${encodeURIComponent(selected.testCase.id)}`, { cache: "no-store" });
      if (!response.ok) {
        if (!canceled) {
          setDetail(null);
          setDetailLoading(false);
        }
        return;
      }
      const payload = (await response.json()) as TestCaseDetail;
      if (!canceled) {
        setDetail(payload);
        setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => {
      canceled = true;
    };
  }, [selected]);

  const items = useMemo(() => {
    if (!data) return [] as QueueItem[];
    if (activeTab === "backlog") return data.backlog;
    if (activeTab === "inProgress") return data.inProgress;
    return data.automated;
  }, [data, activeTab]);

  const ideHref = (item: QueueItem) => {
    const params = new URLSearchParams({ testCaseId: item.testCase.id });
    if (item.draft) params.set("draftId", item.draft.id);
    return `/automacoes/playwright?${params.toString()}`;
  };

  return (
    <section className="rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1 pb-2">
        <div>
          <h2 className="text-lg font-black tracking-[-0.02em] text-[var(--tc-text,#0b1a3c)]">Fila de automação</h2>
          <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
            Casos manuais sem automação, em desenvolvimento e já automatizados/publicados.
          </p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-[var(--tc-border,#d7deea)] px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = data ? (tab.id === "backlog" ? data.backlog.length : tab.id === "inProgress" ? data.inProgress.length : data.automated.length) : 0;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${
                active
                  ? "border-[var(--tc-accent,#ef0001)] text-[var(--tc-accent,#ef0001)]"
                  : "border-transparent text-[var(--tc-text-muted,#6b7280)] hover:text-[var(--tc-text,#0b1a3c)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span className="rounded-full bg-[var(--tc-surface-2,#f8fafc)] px-2 py-0.5 text-[11px] font-black">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {!activeCompanySlug ? (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] p-8 text-center text-sm text-[var(--tc-text-muted,#6b7280)]">
            Selecione uma empresa para ver a fila.
          </div>
        ) : loading ? (
          <div className="col-span-full rounded-2xl border border-[var(--tc-border,#d7deea)] p-8 text-center text-sm text-[var(--tc-text-muted,#6b7280)]">
            Carregando fila…
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-8 text-center text-sm text-[var(--tc-text-secondary,#4b5563)]">
            Nenhum caso nesta fila.
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.testCase.id}
              type="button"
              onClick={() => setSelected(item)}
              className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3 text-left transition hover:border-[var(--tc-accent,#ef0001)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase text-[var(--tc-accent,#ef0001)]">{item.testCase.key ?? item.testCase.id.slice(0, 8)}</p>
                  <p className="mt-1 truncate text-sm font-black text-[var(--tc-text,#0b1a3c)]">{item.testCase.title}</p>
                </div>
                <FiCode className="h-4 w-4 shrink-0 text-[var(--tc-text-muted,#6b7280)]" />
              </div>
              {item.draft ? (
                <p className="mt-2 truncate font-mono text-[11px] text-[var(--tc-text-muted,#6b7280)]">{item.draft.specFile ?? "sem arquivo"}</p>
              ) : null}
            </button>
          ))
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase text-[var(--tc-accent,#ef0001)]">{selected.testCase.key ?? selected.testCase.id.slice(0, 8)}</p>
                <h3 className="mt-1 text-lg font-black text-[var(--tc-text,#0b1a3c)]">{selected.testCase.title}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fechar" className="text-[var(--tc-text-muted,#6b7280)] hover:text-[var(--tc-text,#0b1a3c)]">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <p className="mt-4 text-sm text-[var(--tc-text-muted,#6b7280)]">Carregando caso…</p>
            ) : (
              <>
                {detail?.testCase.objective ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-black uppercase text-[var(--tc-text-muted,#6b7280)]">Objetivo</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{detail.testCase.objective}</p>
                  </div>
                ) : null}

                {detail?.steps?.length ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-black uppercase text-[var(--tc-text-muted,#6b7280)]">Passo a passo</p>
                    <ol className="mt-2 space-y-2">
                      {detail.steps.map((step) => (
                        <li key={step.id} className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-2 text-sm">
                          <p className="font-semibold text-[var(--tc-text,#0b1a3c)]">
                            {step.order}. {step.action}
                          </p>
                          <p className="mt-1 text-[var(--tc-text-secondary,#4b5563)]">Esperado: {step.expectedResult}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </>
            )}

            {selected.draft?.specCode ? (
              <div className="mt-4">
                <p className="text-[11px] font-black uppercase text-[var(--tc-text-muted,#6b7280)]">Script vinculado ({selected.draft.specFile})</p>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#141520] p-3 font-mono text-xs leading-6 text-[#d6d8de]">
                  {selected.draft.specCode}
                </pre>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--tc-text-muted,#6b7280)]">Nenhum script vinculado ainda a este caso.</p>
            )}

            {selected.draft?.githubPublication?.pullRequestUrl ? (
              <a
                href={selected.draft.githubPublication.pullRequestUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--tc-accent,#ef0001)]"
              >
                <FiGitPullRequest className="h-3.5 w-3.5" />
                Ver Pull Request
              </a>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--tc-border,#d7deea)] px-4 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
              >
                Fechar
              </button>
              <Link
                href={ideHref(selected)}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[var(--tc-primary,#011848)] px-4 text-sm font-bold text-white"
              >
                <FiExternalLink className="h-4 w-4" />
                Abrir na IDE
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
