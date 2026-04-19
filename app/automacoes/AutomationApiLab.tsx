"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiClock,
  FiCopy,
  FiDatabase,
  FiGlobe,
  FiPlay,
  FiPlus,
  FiSave,
  FiServer,
  FiTrash2,
} from "react-icons/fi";

import { AUTOMATION_ENVIRONMENTS } from "@/data/automationCatalog";
import { AUTOMATION_API_PRESETS, type AutomationHttpMethod, type AutomationRequestPreset } from "@/data/automationIde";
import { isTestingCompanyScope, matchesAutomationCompanyScope } from "@/lib/automations/companyScope";

type CompanyOption = {
  name: string;
  slug: string;
};

type Props = {
  activeCompanySlug: string | null;
  companies: CompanyOption[];
};

type HeaderRow = {
  id: string;
  key: string;
  value: string;
};

type SavedRequest = AutomationRequestPreset & {
  source: "saved";
};

type HttpResponseState = {
  durationMs: number;
  headers: Record<string, string>;
  json: unknown;
  status: number;
  statusText: string;
  text: string;
  url: string;
};

const STORAGE_PREFIX = "qc:automation:api-lab:v1";

function createHeaderRow(): HeaderRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    key: "",
    value: "",
  };
}

function buildHeaderRows(headers: Array<{ key: string; value: string }>) {
  return headers.length > 0 ? headers.map((item) => ({ ...item, id: Math.random().toString(36).slice(2, 10) })) : [createHeaderRow()];
}

function normalizeBaseUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

function storageKey(companySlug: string | null) {
  return `${STORAGE_PREFIX}:${companySlug ?? "global"}`;
}

export default function AutomationApiLab({ activeCompanySlug }: Props) {
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(isTestingCompanyScope(activeCompanySlug) ? "qc-local" : (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local"));
  const [selectedPresetId, setSelectedPresetId] = useState(AUTOMATION_API_PRESETS[0]?.id ?? "scratch");
  const [requestName, setRequestName] = useState(AUTOMATION_API_PRESETS[0]?.title ?? "Request");
  const [method, setMethod] = useState<AutomationHttpMethod>(AUTOMATION_API_PRESETS[0]?.method ?? "GET");
  const [path, setPath] = useState(AUTOMATION_API_PRESETS[0]?.path ?? "/api/health");
  const [body, setBody] = useState(AUTOMATION_API_PRESETS[0]?.body ?? "");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(buildHeaderRows(AUTOMATION_API_PRESETS[0]?.headers ?? []));
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<HttpResponseState | null>(null);
  const [responseTab, setResponseTab] = useState<"json" | "raw" | "headers">("json");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey(activeCompanySlug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedRequest[];
      if (Array.isArray(parsed)) {
        setSavedRequests(parsed);
      }
    } catch {}
  }, [activeCompanySlug]);

  useEffect(() => {
    setSelectedEnvironmentId((current) => {
      if (isTestingCompanyScope(activeCompanySlug)) {
        return current === "qc-local" ? current : "qc-local";
      }

      return current === "qc-local" ? (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local") : current;
    });
  }, [activeCompanySlug]);

  const currentEnvironment = useMemo(
    () => AUTOMATION_ENVIRONMENTS.find((environment) => environment.id === selectedEnvironmentId) ?? AUTOMATION_ENVIRONMENTS[0],
    [selectedEnvironmentId],
  );

  const visiblePresets = useMemo(
    () => [
      ...AUTOMATION_API_PRESETS.filter((preset) => matchesAutomationCompanyScope(preset.companyScope, activeCompanySlug)),
      ...savedRequests,
    ],
    [activeCompanySlug, savedRequests],
  );

  useEffect(() => {
    if (visiblePresets.some((preset) => preset.id === selectedPresetId)) return;
    if (visiblePresets[0]) {
      applyPreset(visiblePresets[0]);
    }
  }, [selectedPresetId, visiblePresets]);

  function applyPreset(preset: AutomationRequestPreset | SavedRequest) {
    setSelectedPresetId(preset.id);
    setRequestName(preset.title);
    setMethod(preset.method);
    setPath(preset.path);
    setBody(preset.body);
    setHeaderRows(buildHeaderRows(preset.headers));
    setErrorMessage(null);
    setResponse(null);
  }

  function persistSavedRequests(nextRequests: SavedRequest[]) {
    setSavedRequests(nextRequests);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(activeCompanySlug), JSON.stringify(nextRequests));
  }

  function saveCurrentRequest() {
    const snapshot: SavedRequest = {
      id: `saved-${Date.now()}`,
      title: requestName.trim() || "Request salvo",
      method,
      path,
      body,
      headers: headerRows.filter((row) => row.key.trim()).map((row) => ({ key: row.key.trim(), value: row.value })),
      companyScope: "all",
      tags: ["saved"],
      source: "saved",
    };

    persistSavedRequests([snapshot, ...savedRequests]);
    setCopyFeedback("Request salvo localmente");
    window.setTimeout(() => setCopyFeedback(null), 1400);
  }

  function removeSavedRequest(requestId: string) {
    persistSavedRequests(savedRequests.filter((request) => request.id !== requestId));
    if (selectedPresetId === requestId) {
      applyPreset(AUTOMATION_API_PRESETS[0]);
    }
  }

  async function executeRequest() {
    setLoading(true);
    setErrorMessage(null);
    setResponse(null);

    try {
      const headers = headerRows.reduce<Record<string, string>>((accumulator, row) => {
        if (!row.key.trim()) return accumulator;
        accumulator[row.key.trim()] = row.value;
        return accumulator;
      }, {});

      const resolvedUrl = normalizeBaseUrl(currentEnvironment.baseUrl, path);
      const execution = await fetch("/api/automations/http", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: body.trim() ? body : null,
          headers,
          method,
          timeoutMs: 15000,
          url: resolvedUrl,
        }),
      });
      const payload = await execution.json();

      if (!execution.ok || !payload?.response) {
        throw new Error(payload?.error || "Não foi possível executar a chamada.");
      }

      setResponse(payload.response as HttpResponseState);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao executar request.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResponse() {
    if (!response) return;
    const content = responseTab === "headers" ? JSON.stringify(response.headers, null, 2) : responseTab === "raw" ? response.text : JSON.stringify(response.json ?? response.text, null, 2);
    await navigator.clipboard.writeText(content);
    setCopyFeedback("Resposta copiada");
    window.setTimeout(() => setCopyFeedback(null), 1400);
  }

  return (
    <section className="space-y-4 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiServer className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            API Lab
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiGlobe className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {currentEnvironment?.title}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveCurrentRequest}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
          >
            <FiSave className="h-4 w-4" />
            Salvar
          </button>
          <button
            type="button"
            onClick={executeRequest}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <FiPlay className="h-4 w-4" />
            {loading ? "Executando" : "Executar"}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <aside className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 xl:col-span-4 xl:sticky xl:top-6 2xl:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Coleção</p>
            <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              {visiblePresets.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {visiblePresets.map((preset) => {
              const active = selectedPresetId === preset.id;
              const isSaved = "source" in preset && preset.source === "saved";
              return (
                <div key={preset.id} className={`rounded-xl border ${active ? "border-(--tc-accent,#ef0001) bg-white" : "border-(--tc-border,#d7deea) bg-white/70"}`}>
                  <button type="button" onClick={() => applyPreset(preset)} className="w-full px-3 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{preset.title}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                          {preset.method} {preset.tags.join(" • ")}
                        </p>
                      </div>
                      {isSaved ? <FiDatabase className="mt-0.5 h-4 w-4 shrink-0 text-(--tc-accent,#ef0001)" /> : null}
                    </div>
                  </button>
                  {isSaved ? (
                    <div className="border-t border-(--tc-border,#d7deea) px-3 py-2">
                      <button type="button" onClick={() => removeSavedRequest(preset.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-(--tc-text-muted,#6b7280)">
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <article className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 xl:col-span-8 2xl:col-span-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_110px_180px] 2xl:grid-cols-[minmax(0,1fr)_110px_180px_auto]">
            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Request
              <input
                value={requestName}
                onChange={(event) => setRequestName(event.target.value)}
                className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Método
              <select value={method} onChange={(event) => setMethod(event.target.value as AutomationHttpMethod)} className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none">
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Ambiente
              <select value={selectedEnvironmentId} onChange={(event) => setSelectedEnvironmentId(event.target.value)} className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none">
                {AUTOMATION_ENVIRONMENTS.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end xl:col-span-3 2xl:col-span-1">
              <div className="inline-flex min-h-11 items-center rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-xs font-semibold text-(--tc-text-muted,#6b7280)">
                {currentEnvironment?.baseUrl}
              </div>
            </div>
          </div>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Path / URL
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
            />
          </label>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(260px,0.44fr)_minmax(0,0.56fr)]">
            <section className="rounded-[16px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Headers</p>
                <button
                  type="button"
                  onClick={() => setHeaderRows((current) => [...current, createHeaderRow()])}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {headerRows.map((row) => (
                  <div key={row.id} className="grid gap-2 md:grid-cols-[minmax(0,0.44fr)_minmax(0,0.56fr)_36px]">
                    <input
                      value={row.key}
                      onChange={(event) =>
                        setHeaderRows((current) => current.map((item) => (item.id === row.id ? { ...item, key: event.target.value } : item)))
                      }
                      placeholder="Header"
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                    />
                    <input
                      value={row.value}
                      onChange={(event) =>
                        setHeaderRows((current) => current.map((item) => (item.id === row.id ? { ...item, value: event.target.value } : item)))
                      }
                      placeholder="Valor"
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setHeaderRows((current) => (current.length === 1 ? [createHeaderRow()] : current.filter((item) => item.id !== row.id)))}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Body
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={12}
                placeholder='{"cpf":"12345678900"}'
                className="rounded-[16px] border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-white outline-none"
              />
            </label>
          </div>
        </article>

        <aside className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 xl:col-span-12 2xl:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Response</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyResponse}
                disabled={!response}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c) disabled:opacity-40"
              >
                <FiCopy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Status</p>
              <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">{response ? `${response.status} ${response.statusText}` : "--"}</p>
            </div>
            <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Duração</p>
              <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">{response ? `${response.durationMs} ms` : "--"}</p>
            </div>
            <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">URL</p>
              <p className="mt-1 truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{response?.url ?? normalizeBaseUrl(currentEnvironment.baseUrl, path)}</p>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700">{errorMessage}</div>
          ) : null}
          {copyFeedback ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">{copyFeedback}</div>
          ) : null}

          <div className="mt-4 inline-flex rounded-xl border border-(--tc-border,#d7deea) bg-white p-1">
            {[
              { id: "json", label: "JSON" },
              { id: "raw", label: "Raw" },
              { id: "headers", label: "Headers" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setResponseTab(tab.id as typeof responseTab)}
                className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${responseTab === tab.id ? "bg-(--tc-surface-2,#f8fafc) text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280)"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-[420px] rounded-[16px] border border-(--tc-border,#d7deea) bg-[#081227] p-4">
            <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white">
              {responseTab === "headers"
                ? JSON.stringify(response?.headers ?? {}, null, 2)
                : responseTab === "raw"
                  ? response?.text || ""
                  : JSON.stringify(response?.json ?? null, null, 2)}
            </pre>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-(--tc-text-muted,#6b7280)">
            <FiClock className="h-4 w-4" />
            BFF interno para request sem abrir Postman.
          </div>
        </aside>
      </div>
    </section>
  );
}
