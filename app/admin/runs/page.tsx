"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { getAppMeta } from "@/lib/appMeta";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";

type AdminRun = {
  slug: string;
  title: string;
  summary: string;
  runId?: number;
  app: string;
  project?: string;
  radis?: string;
  source?: "API" | "MANUAL";
};

const APP_COLOR_CLASS: Record<string, string> = {
  smart: "app-color-smart",
  sfq: "app-color-smart",
  print: "app-color-print",
  booking: "app-color-booking",
  cds: "app-color-cds",
  trust: "app-color-trust",
  "cidadao-smart": "app-color-cidadao",
  gmt: "app-color-gmt",
  "mobile-griaule": "app-color-gmt",
};

export default function AdminRunsPage() {
  const { user } = useAuthUser();
  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const isAdmin = Boolean(user?.isGlobalAdmin || role === "admin");
  const isCompany = role === "company";
  const canCreate = isAdmin || isCompany;
  const canDelete = isAdmin;

  const [title, setTitle] = useState("");
  const [runId, setRunId] = useState("");
  const [app, setApp] = useState("");
  const [radis, setRadis] = useState("");
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<AdminRun[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [toast, setToast] = useState<{ message: string; type: "ok" | "error" } | null>(null);

  const slugPreview = useMemo(() => slugifyRelease(title || "nova_run"), [title]);

  const load = async () => {
    setLoading(true);
    try {
      const [apiRes, manualRes] = await Promise.all([
        fetch("/api/releases", { cache: "no-store" }),
        fetch("/api/releases-manual", { cache: "no-store" }),
      ]);

      const apiJson = await apiRes.json().catch(() => ({}));
      const apiList = Array.isArray(apiJson?.releases) ? (apiJson.releases as AdminRun[]) : [];

      const manualJson = await manualRes.json().catch(() => []);
      const manualRows = Array.isArray(manualJson) ? (manualJson as unknown[]) : [];
      const manualList: AdminRun[] = [];
      for (const row of manualRows) {
        const r = (row ?? null) as Record<string, unknown> | null;
        if (!r) continue;
        const slug = typeof r.slug === "string" ? r.slug : "";
        if (!slug) continue;
        const name = typeof r.name === "string" ? r.name : typeof r.title === "string" ? r.title : slug;
        const summary =
          typeof r.observations === "string"
            ? r.observations
            : typeof r.summary === "string"
              ? r.summary
              : "Run manual";
        const app = typeof r.app === "string" ? r.app : "SMART";
        const runId = typeof r.runId === "number" ? r.runId : undefined;
        manualList.push({ slug, title: name, summary, app, runId, source: "MANUAL" });
      }

      const merged = new Map<string, AdminRun>();
      [...manualList, ...apiList.map((r) => ({ ...r, source: "API" as const }))].forEach((r) => merged.set(r.slug, r));
      setItems(Array.from(merged.values()));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setFeedback(null);
    setFeedbackType(null);
    const trimmedTitle = title.trim();
    const trimmedRun = runId.trim();
    const trimmedApp = app.trim();
    const trimmedRadis = radis.trim();
    const runNumber = Number(trimmedRun);
    const cleanedTitle = trimmedTitle.replace(/^run\s*/i, "");

    if (!cleanedTitle || !trimmedRun || Number.isNaN(runNumber) || runNumber <= 0 || !trimmedApp) {
      const msg = "Preencha nome, runId (numero) e selecione o projeto.";
      setFeedback(msg);
      setFeedbackType("error");
      setToast({ message: msg, type: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanedTitle,
          runId: runNumber,
          app: trimmedApp,
          summary: summary.trim() || "Run cadastrada pelo painel.",
          radis: trimmedRadis,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeedback(data.error || "Erro ao salvar.");
        setSaving(false);
        return;
      }
      const data = await res.json();
      setItems((prev) => {
        const filtered = prev.filter((item) => item.slug !== data.release.slug);
        return [...filtered, data.release];
      });
      setTitle("");
      setRunId("");
      setSummary("");
      setRadis("");
      const okMsg = "Tudo certinho. Run salva.";
      setFeedback(okMsg);
      setFeedbackType("ok");
      setToast({ message: okMsg, type: "ok" });
    } catch {
      const errMsg = "Erro ao salvar.";
      setFeedback(errMsg);
      setFeedbackType("error");
      setToast({ message: errMsg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string, source?: AdminRun["source"]) => {
    const confirmDelete = typeof window === "undefined" ? true : window.confirm("Remover esta run?");
    if (!confirmDelete) return;

    if (source === "MANUAL") {
      await fetch(`/api/releases-manual/${encodeURIComponent(slug)}`, { method: "DELETE", credentials: "include" });
    } else {
      await fetch("/api/releases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    }
    setItems((prev) => prev.filter((item) => item.slug !== slug));
    setToast({ message: "Run removida.", type: "ok" });
  };

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.slug.localeCompare(b.slug)), [items]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(sortedItems.length / pageSize));
    if (currentPage > total) {
      setCurrentPage(total);
    }
  }, [sortedItems.length, currentPage, pageSize]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-(--tc-accent,#ef0001)">Gestão de Runs</p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Gerenciar Runs</h1>
              <p className="text-(--tc-text-secondary,#4b5563) max-w-3xl">
                Cadastre runs salvando em arquivo JSON do painel. Informe o nome, o ID da run no Qase e o projeto (ex.: sfq)
                para gerar a URL e permitir buscar estatísticas automaticamente.
              </p>
            </div>
            <div className="flex items-center">
              <CreateManualReleaseButton />
            </div>
          </div>
        </div>

        {canCreate && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm md:grid-cols-[1fr_1fr_0.6fr_auto]"
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm text-(--tc-text-secondary,#4b5563)">Nome da run</label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFeedback(null);
              }}
              placeholder="Ex.: SFQ v1.9.0 ACE"
              className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-(--tc-text-primary,#011848) placeholder:text-(--tc-text-muted,#6b7280) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/40"
            />
            <p className="text-xs text-(--tc-text-muted,#6b7280)">Slug: {slugPreview}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-(--tc-text-secondary,#4b5563)">ID da run no Qase</label>
            <input
              value={runId}
              onChange={(e) => {
                setRunId(e.target.value);
                setFeedback(null);
              }}
              placeholder="Ex.: 21"
              className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-(--tc-text-primary,#011848) placeholder:text-(--tc-text-muted,#6b7280) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/40"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-(--tc-text-secondary,#4b5563)">Projeto (Qase)</label>
            <select
              aria-label="Selecionar projeto do Qase"
              value={app}
              onChange={(e) => setApp(e.target.value)}
              className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-(--tc-text-primary,#011848) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/40"
            >
              <option value="">Selecione o projeto</option>
              <option value="sfq">SFQ</option>
              <option value="print">PRINT</option>
              <option value="booking">Booking</option>
              <option value="cds">CDS</option>
              <option value="gmt">GMT</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-(--tc-text-secondary,#4b5563)">RADIS</label>
            <input
              value={radis}
              onChange={(e) => setRadis(e.target.value)}
              placeholder="RADIS_3"
              className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-(--tc-text-primary,#011848) placeholder:text-(--tc-text-muted,#6b7280) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/40"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-(--tc-accent,#ef0001) px-4 py-3 font-semibold text-white shadow-(--tc-accent-soft,rgba(239,0,1,0.12)) transition hover:brightness-110 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>

          <div className="md:col-span-4">
            <label className="text-sm text-(--tc-text-secondary,#4b5563)">Resumo</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Resumo curto (opcional)"
              className="mt-2 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-3 text-(--tc-text-primary,#011848) placeholder:text-(--tc-text-muted,#6b7280) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/40"
            />
          </div>

          {feedback && (
            <p
              className={`md:col-span-4 text-sm ${
                feedbackType === "error" ? "text-red-400" : "text-(--tc-accent,#ef0001)"
              }`}
            >
              {feedback}
            </p>
          )}
        </form>
        )}

        <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Runs cadastradas</h2>
            <div className="flex items-center gap-2 text-sm text-(--tc-text-secondary,#4b5563)">
              <label className="flex items-center gap-1">
                <span className="text-xs">por pagina</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-(--tc-border,#e5e7eb) bg-white px-2 py-1 text-xs text-(--page-text,#0b1a3c) focus:outline-none focus:ring-1 focus:ring-(--tc-accent,#ef0001)/50"
                >
                  {[2, 5, 10].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-1 text-xs text-(--page-text,#0b1a3c) hover:bg-(--tc-accent,#ef0001)/8 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-(--page-text,#0b1a3c)">
                {currentPage} / {Math.max(1, Math.ceil(sortedItems.length / pageSize))}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(sortedItems.length / pageSize) || 1, p + 1))}
                disabled={currentPage >= Math.ceil(sortedItems.length / pageSize)}
                className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-1 text-xs text-(--page-text,#0b1a3c) hover:bg-(--tc-accent,#ef0001)/8 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Proxima
              </button>
            </div>
          </div>

        {loading ? (
          <p className="text-(--tc-text-muted,#6b7280)">Carregando...</p>
        ) : sortedItems.length === 0 ? (
          <p className="text-(--tc-text-muted,#6b7280)">Nenhuma run salva ainda.</p>
        ) : (
          <div className="grid gap-4">
            {pagedItems.map((item) => {
                const chipKey = (item.app ?? item.project ?? "smart").toLowerCase();
                const meta = getAppMeta(chipKey, chipKey.toUpperCase());
                const chipText = meta.label ?? (item.app ?? item.project ?? "APP").toUpperCase();
                const appTagClass = APP_COLOR_CLASS[chipKey] ?? "app-color-default";
                const titleClean = (item.title ?? "").replace(/^run\s*/i, "");
                return (
                <div
                  key={item.slug}
                  className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-5 space-y-4 shadow-sm transition hover:border-(--tc-accent,#ef0001)/60 hover:shadow-lg"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className={`app-tag text-[12px] ${appTagClass}`}>{chipText}</span>
                      {item.radis && (
                        <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-1 uppercase text-(--page-text,#0b1a3c)">
                          RADIS: {item.radis}
                        </span>
                      )}
                      {item.runId ? (
                        <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-1 text-(--page-text,#0b1a3c)">
                          Run {item.runId}
                        </span>
                      ) : (
                        <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-1 text-(--page-text,#0b1a3c)">
                          Manual
                        </span>
                      )}
                      <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-1 truncate max-w-52 text-(--page-text,#0b1a3c)">
                        Slug: /release/{item.slug}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/release/${item.slug}`}
                        aria-label={`Abrir release ${titleClean || item.slug}`}
                        className="rounded-lg border border-(--tc-accent,#ef0001)/70 px-4 py-2 text-sm font-semibold text-(--tc-accent,#ef0001) transition hover:bg-(--tc-accent-soft,rgba(239,0,1,0.12)) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/40"
                      >
                        Abrir
                      </a>
                      {canDelete && (
                        <button
                          data-testid="run-delete"
                          type="button"
                          onClick={() => handleDelete(item.slug, item.source)}
                          aria-label={`Deletar release ${titleClean || item.slug}`}
                          className="rounded-lg border border-red-400/60 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-300"
                        >
                          Deletar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-(--page-text,#0b1a3c)">{titleClean}</h3>
                    <p className="text-sm text-(--tc-text-secondary,#4b5563) leading-snug">
                      {item.summary || "Sem resumo informado."}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                      <span>Slug: {item.slug}</span>
                      <span>Run ID: {item.runId ?? "--"}</span>
                      {item.radis && <span>RADIS: {item.radis}</span>}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm text-(--tc-text-secondary,#4b5563) pt-2 md:flex-row md:items-center md:justify-between">
            <span>Mostrando {pagedItems.length} de {sortedItems.length} itens</span>
            <div />
          </div>
        </div>

        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.type === "error"
                ? "border-red-400/60 bg-white text-red-600"
                : "border-(--tc-accent,#ef0001)/60 bg-white text-(--tc-accent,#ef0001)"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
