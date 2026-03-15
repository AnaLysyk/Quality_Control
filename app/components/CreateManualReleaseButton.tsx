"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAppMeta } from "@/lib/appMeta";
import { useAuthUser } from "@/hooks/useAuthUser";

type NewManualRelease = {
  name: string;
  app: string;
  slug: string;
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  observations?: string;
};

const initialState: NewManualRelease = {
  name: "",
  app: "SMART",
  slug: "",
  pass: 0,
  fail: 0,
  blocked: 0,
  notRun: 0,
  observations: "",
};

type CaseStatus = "pass" | "fail" | "blocked" | "notRun";

type ManualCaseDraft = {
  id: string;
  title: string;
  link: string;
  status: CaseStatus;
};

type CaseColumn = {
  key: CaseStatus;
  label: string;
  containerBg: string;
  borderClass: string;
  cardBorder: string;
  cardBg: string;
  accentText: string;
};

const CASE_COLUMNS: CaseColumn[] = [
  {
    key: "pass",
    label: "Aprovado",
    containerBg: "bg-[rgba(124,211,67,0.08)] dark:bg-[rgba(124,211,67,0.15)]",
    borderClass: "border-[rgba(124,211,67,0.45)]",
    cardBorder: "border-[rgba(124,211,67,0.35)]",
    cardBg: "bg-white dark:bg-white/5",
    accentText: "text-[rgba(124,211,67,1)]",
  },
  {
    key: "fail",
    label: "Falha",
    containerBg: "bg-[rgba(239,0,1,0.08)] dark:bg-[rgba(239,0,1,0.15)]",
    borderClass: "border-[rgba(239,0,1,0.45)]",
    cardBorder: "border-[rgba(239,0,1,0.35)]",
    cardBg: "bg-white dark:bg-white/5",
    accentText: "text-[rgba(239,0,1,1)]",
  },
  {
    key: "blocked",
    label: "Bloqueado",
    containerBg: "bg-[rgba(255,167,58,0.12)] dark:bg-[rgba(255,167,58,0.2)]",
    borderClass: "border-[rgba(255,167,58,0.45)]",
    cardBorder: "border-[rgba(255,167,58,0.35)]",
    cardBg: "bg-white dark:bg-white/5",
    accentText: "text-[rgba(255,167,58,1)]",
  },
  {
    key: "notRun",
    label: "Não Executado",
    containerBg: "bg-[rgba(15,22,38,0.08)] dark:bg-[rgba(15,22,38,0.4)]",
    borderClass: "border-[rgba(15,22,38,0.35)]",
    cardBorder: "border-[rgba(15,22,38,0.30)]",
    cardBg: "bg-white dark:bg-white/5",
    accentText: "text-(--tc-text-primary,#0b1a3c)",
  },
];

const CASE_STATUS_VALUES: Record<CaseStatus, "APROVADO" | "FALHA" | "BLOQUEADO" | "NAO_EXECUTADO"> = {
  pass: "APROVADO",
  fail: "FALHA",
  blocked: "BLOQUEADO",
  notRun: "NAO_EXECUTADO",
};

const initialCaseDraft: ManualCaseDraft = {
  id: "",
  title: "",
  link: "",
  status: "notRun",
};

export function CreateManualReleaseButton({
  companySlug,
  redirectToRun = true,
  onCreated,
}: {
  companySlug?: string;
  redirectToRun?: boolean;
  onCreated?: (release: { slug?: string; name?: string; title?: string }) => void;
}) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<NewManualRelease>(initialState);
  const [cases, setCases] = useState<ManualCaseDraft[]>([]);
  const [caseDraft, setCaseDraft] = useState<ManualCaseDraft>({ ...initialCaseDraft });
  const nameInputId = "manual-release-name";
  const appSelectId = "manual-release-app";
  const observationsId = "manual-release-observations";
  const statInputIds = {
    pass: "manual-release-pass",
    fail: "manual-release-fail",
    blocked: "manual-release-blocked",
    notRun: "manual-release-not-run",
  } as const;

  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const canCreate = Boolean(user?.isGlobalAdmin || role === "admin" || role === "company");

  if (loading || !canCreate) return null;

  const apps = [
    "SMART",
    "PRINT",
    "BOOKING",
    "CDS",
    "TRUST",
    "CIDADAO SMART",
    "GMT",
  ];

  const total = form.pass + form.fail + form.blocked + form.notRun;
  const appMeta = getAppMeta(form.app.toLowerCase(), form.app);

  const handleFailClick = () => {
    if (form.fail === 0) {
      setForm((prev) => ({ ...prev, fail: 1 }));
    }
  };

  const handleNumber = (key: keyof NewManualRelease, value: string) => {
    const n = Math.max(0, Number(value) || 0);
    setForm((prev) => ({ ...prev, [key]: n }));
  };

  const handleCaseDraftChange = <K extends keyof ManualCaseDraft>(field: K, value: ManualCaseDraft[K]) => {
    setCaseDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddCase = () => {
    const trimmedId = caseDraft.id.trim();
    const trimmedTitle = caseDraft.title.trim();
    if (!trimmedId || !trimmedTitle) return;

    setCases((prev) => [
      ...prev,
      {
        id: trimmedId,
        title: trimmedTitle,
        link: caseDraft.link.trim(),
        status: caseDraft.status,
      },
    ]);
    setCaseDraft({ ...initialCaseDraft, status: caseDraft.status });
  };

  const handleRemoveCase = (id: string) => {
    setCases((prev) => prev.filter((c) => c.id !== id));
  };

  const groupedCases = CASE_COLUMNS.reduce<Record<CaseStatus, ManualCaseDraft[]>>((acc, column) => {
    acc[column.key] = cases.filter((item) => item.status === column.key);
    return acc;
  }, {
    pass: [],
    fail: [],
    blocked: [],
    notRun: [],
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/releases-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
          body: JSON.stringify({
            kind: "run",
            name: form.name.trim(),
            app: form.app,
            slug: form.slug,
            ...(companySlug ? { clientSlug: companySlug } : {}),
            stats: {
              pass: form.pass,
              fail: form.fail,
              blocked: form.blocked,
              notRun: form.notRun,
            },
            observations: form.observations,
          }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const message =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          "Erro ao criar run";
        throw new Error(message);
      }
      const created = await res.json();
      if (cases.length) {
        const casesRes = await fetch(`/api/releases-manual/${created.slug}/cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            cases.map((item) => ({
              id: item.id,
              title: item.title,
              link: item.link || undefined,
              status: CASE_STATUS_VALUES[item.status],
              fromApi: false,
            })),
          ),
        });
        if (!casesRes.ok) {
          console.error("Erro ao vincular casos", await casesRes.text());
        }
      }
      setOpen(false);
      setForm(initialState);
      setCases([]);
      setCaseDraft({ ...initialCaseDraft });
      setSaving(false);
      onCreated?.(created as { slug?: string; name?: string; title?: string });
      if (redirectToRun) {
        const target = companySlug
          ? `/empresas/${encodeURIComponent(companySlug)}/runs/${created.slug}`
          : `/release/${created.slug}`;
        if (typeof window !== "undefined") {
          const expectedPath = new URL(target, window.location.origin).pathname;
          const isE2E = typeof navigator !== "undefined" && navigator.webdriver === true;
          if (isE2E) {
            window.location.assign(target);
            return;
          }
          router.push(target);
          setTimeout(() => {
            if (window.location.pathname !== expectedPath) {
              window.location.assign(target);
            }
          }, 50);
        } else {
          router.push(target);
        }
      } else {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      setSubmitError(e instanceof Error ? e.message : "Erro ao criar run");
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        data-testid="create-run"
        type="button"
        onClick={() => {
          setSubmitError(null);
          setOpen(true);
        }}
        className="rounded-xl bg-(--tc-accent) px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110"
      >
        <span data-testid="run-create">Criar run manual</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl max-h-[85vh] overflow-y-auto space-y-6 rounded-3xl border border-(--tc-border)/30 bg-white text-(--tc-text,#0f172a) shadow-[0_25px_80px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-(--tc-surface-dark,#0f1828) dark:text-(--tc-text-inverse,#fff) p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-(--tc-text-primary,#0b1a3c) dark:text-(--tc-text-inverse,#fff)">Nova run manual</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-(--tc-text-muted) transition hover:text-(--tc-text-primary,#0b1a3c) dark:hover:text-white"
              >
                fechar
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid gap-6">
                <div className="min-w-0 space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label htmlFor={nameInputId} className="text-sm font-semibold text-(--tc-text-muted)">Título</label>
                      <input
                        id={nameInputId}
                        className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface-darker,#0c1220) dark:text-(--tc-text-inverse,#fff)"
                        data-testid="run-title"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Run 1.9.0 - Aceitação"
                      />
                      <input
                        aria-hidden="true"
                        tabIndex={-1}
                        data-testid="run-name"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="sr-only"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={appSelectId} className="text-sm font-semibold text-(--tc-text-muted)">Aplicação</label>
                      <select
                        id={appSelectId}
                        aria-label="Selecionar aplicação"
                        className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface-darker,#0c1220) dark:text-(--tc-text-inverse,#fff)"
                        value={form.app}
                        onChange={(e) => setForm((prev) => ({ ...prev, app: e.target.value }))}
                      >
                        {apps.map((app) => (
                          <option key={app} value={app}>
                            {app}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-(--tc-text-muted)">
                        {appMeta.label} • cor aplicada automaticamente
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-(--tc-text-muted)">Release (slug)</label>
                      <input
                        className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface-darker,#0c1220) dark:text-(--tc-text-inverse,#fff)"
                        data-testid="run-slug"
                        value={form.slug}
                        onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                        placeholder="Ex: v1_8_0_reg"
                      />
                      <div className="text-xs text-(--tc-text-muted)">Slug da release a ser impactada (ex: v1_8_0_reg)</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {(["pass", "fail", "blocked", "notRun"] as const).map((key) => (
                      <div key={key} className="space-y-1">
                        <label htmlFor={statInputIds[key]} className="text-xs uppercase tracking-wide text-(--tc-text-muted)">{key}</label>
                        <input
                          id={statInputIds[key]}
                          type="number"
                          min={0}
                          aria-label={`Total ${key}`}
                          className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface-darker,#0c1220) dark:text-(--tc-text-inverse,#fff)"
                          data-testid={
                            key === "pass"
                              ? "run-stat-pass"
                              : key === "fail"
                                ? "run-stat-fail"
                                : key === "blocked"
                                  ? "run-stat-blocked"
                                  : "run-stat-not-run"
                          }
                          value={form[key]}
                          onChange={(e) => handleNumber(key, e.target.value)}
                          onClick={key === "fail" ? handleFailClick : undefined}
                        />
                        {key === "fail" && (
                          <button
                            type="button"
                            data-testid="run-status-fail"
                            onClick={handleFailClick}
                            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--tc-accent,#ef0001)"
                          >
                            Marcar falha
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-(--tc-text-muted)">
                    <span>Total: {total}</span>
                    <span>
                      Pass%: {total > 0 ? Math.round((form.pass / total) * 100) : 0}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={observationsId} className="text-sm font-semibold text-(--tc-text-muted)">Observações</label>
                    <textarea
                      id={observationsId}
                      className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface,#f8fafc) px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface-darker,#0c1220) dark:text-(--tc-text-inverse,#fff)"
                      rows={3}
                      value={form.observations}
                      onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))}
                      placeholder="Notas sobre a run..."
                    />
                  </div>
                </div>

                <div className="min-w-0 space-y-4 pt-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-(--tc-text-muted)">Casos vinculados</p>
                      <p className="text-xs text-(--tc-text-muted)">{cases.length} caso(s) adicionados</p>
                    </div>
                    <div className="text-xs text-(--tc-text-muted)">Inclua ID, título e link antes de salvar</div>
                  </div>

                  <div className="rounded-2xl border border-(--tc-border)/60 bg-(--tc-surface,#f8fafc) p-5 shadow-sm dark:border-white/10 dark:bg-(--tc-surface-darker,#0c1120)">
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted)">ID do caso</label>
                        <input
                          type="text"
                          autoFocus
                          value={caseDraft.id}
                          onChange={(e) => handleCaseDraftChange("id", e.target.value)}
                          className="w-full rounded-[18px] border border-(--tc-border) bg-white px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface,#0f1728) dark:text-(--tc-text-inverse,#fff)"
                          placeholder="Ex: 12345"
                        />
                      </div>
                      <div className="space-y-1 lg:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted)">Título</label>
                        <input
                          type="text"
                          value={caseDraft.title}
                          onChange={(e) => handleCaseDraftChange("title", e.target.value)}
                          className="w-full rounded-[18px] border border-(--tc-border) bg-white px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface,#0f1728) dark:text-(--tc-text-inverse,#fff)"
                          placeholder="Nome do caso"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted)">Link (opcional)</label>
                        <input
                          type="url"
                          value={caseDraft.link}
                          onChange={(e) => handleCaseDraftChange("link", e.target.value)}
                          className="w-full rounded-[18px] border border-(--tc-border) bg-white px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface,#0f1728) dark:text-(--tc-text-inverse,#fff)"
                          placeholder="https://app.qase.io/case/..."
                        />
                      </div>
                      <div className="space-y-1">
                      <label htmlFor="case-status-select" className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted)">Status</label>
                      <select
                        id="case-status-select"
                        aria-label="Status do caso"
                        value={caseDraft.status}
                        onChange={(e) => handleCaseDraftChange("status", e.target.value as CaseStatus)}
                        className="w-full rounded-[18px] border border-(--tc-border) bg-white px-3 py-2 text-sm text-(--tc-text,#0f172a) shadow-sm outline-none transition focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/40 dark:border-white/20 dark:bg-(--tc-surface,#0f1728) dark:text-(--tc-text-inverse,#fff)"
                      >
                          {CASE_COLUMNS.map((column) => (
                            <option key={column.key} value={column.key}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAddCase}
                        className="rounded-[26px] bg-(--tc-accent) px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow transition hover:brightness-110 disabled:opacity-60"
                        disabled={!caseDraft.id.trim() || !caseDraft.title.trim()}
                      >
                        Adicionar ao Kanban
                      </button>
                      <span className="text-xs text-(--tc-text-muted)">Os campos ID e título são obrigatórios.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-(--tc-text-muted)">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-(--tc-text-muted)">Kanban</p>
                    <p className="text-xs text-(--tc-text-muted)">{cases.length} caso(s)</p>
                  </div>
                  <div className="text-xs text-(--tc-text-muted)">Role para ver todos os cartões</div>
                </div>
                <div className="rounded-2xl border border-(--tc-border)/60 bg-white/90 p-4 shadow-sm dark:bg-(--tc-surface-dark,#0f1828) dark:border-white/10">
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 max-h-80 overflow-y-auto pr-2">
                    {CASE_COLUMNS.map((column) => {
                      const batch = groupedCases[column.key];
                      return (
                        <div
                          key={column.key}
                          className={`flex flex-col rounded-2xl border ${column.borderClass} ${column.containerBg} p-4 shadow-sm backdrop-blur`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-(--tc-text-muted)">
                            <span>{column.label}</span>
                            <span className={`text-xs ${column.accentText}`}>{batch.length}</span>
                          </div>
                          <div className="mt-3 space-y-3">
                            {batch.length === 0 ? (
                              <p className="text-xs italic text-(--tc-text-muted)">Nenhum caso nesta coluna</p>
                            ) : (
                              batch.map((item) => (
                                <div
                                  key={`case-${column.key}-${item.id}`}
                                  className={`relative rounded-2xl border ${column.cardBorder} ${column.cardBg} px-3 py-3 text-sm text-(--tc-text,#0f172a) shadow-[0_10px_25px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5`}
                                >
                                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-(--tc-text-muted)">
                                    <span>ID</span>
                                    <strong className={`dark:text-white ${column.accentText}`}>{item.id}</strong>
                                  </div>
                                  <p className="mt-2 text-sm font-semibold leading-snug">{item.title}</p>
                                  {item.link ? (
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-(--tc-accent,#ef0001)"
                                    >
                                      Ver link
                                    </a>
                                  ) : (
                                    <p className="mt-2 text-[11px] text-(--tc-text-muted)">Sem link</p>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCase(item.id)}
                                    className="absolute top-2 right-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:text-rose-400"
                                  >
                                    Remover
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {submitError && <p className="text-sm text-rose-600">{submitError}</p>}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  setOpen(false);
                }}
                className="rounded-2xl border border-(--tc-border)/60 px-4 py-2 text-sm font-semibold text-(--tc-text,#0f172a) transition hover:border-(--tc-text-primary,#0b1a3c) hover:text-(--tc-text-primary,#0b1a3c) dark:border-white/20 dark:text-(--tc-text-inverse,#fff)"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !form.name.trim()}
                data-testid="run-submit"
                className="rounded-2xl bg-(--tc-accent) px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Salvando..." : <span data-testid="run-save">Salvar e abrir</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
