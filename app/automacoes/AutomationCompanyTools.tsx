"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiCheckCircle,
  FiCopy,
  FiGrid,
  FiPlay,
  FiSearch,
  FiServer,
  FiShield,
  FiTool,
} from "react-icons/fi";

import type { AutomationAccess } from "@/lib/automations/access";
import {
  AUTOMATION_ENVIRONMENTS,
  AUTOMATION_FLOWS,
  describeAutomationEnvironmentRequirements,
} from "@/data/automationCatalog";
import { AUTOMATION_API_PRESETS, AUTOMATION_COMPANY_TOOLS, type AutomationCompanyTool } from "@/data/automationIde";
import { isTestingCompanyScope, matchesAutomationCompanyScope } from "@/lib/automations/companyScope";

type CompanyOption = {
  name: string;
  slug: string;
};

type Props = {
  access: AutomationAccess;
  activeCompanySlug: string | null;
  companies: CompanyOption[];
};

type ToolResponse = {
  durationMs?: number;
  headers?: Record<string, string>;
  json?: unknown;
  status?: number;
  statusText?: string;
  text?: string;
  url?: string;
  [key: string]: unknown;
};

function normalizeBaseUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

function coerceFieldValue(
  value: string | number | boolean | undefined,
  type: AutomationCompanyTool["fields"][number]["type"],
): string | number | boolean {
  if (type === "switch") return Boolean(value);
  if (type === "number") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : "";
  }
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value;
  return "";
}

function applyTemplate(template: unknown, values: Record<string, string | number | boolean>): unknown {
  if (typeof template === "string") {
    const fullMatch = template.match(/^\{\{(.+)\}\}$/);
    if (fullMatch) {
      return values[fullMatch[1]] ?? "";
    }
    return template.replace(/\{\{(.+?)\}\}/g, (_, key) => String(values[key] ?? ""));
  }

  if (Array.isArray(template)) {
    return template.map((item) => applyTemplate(item, values));
  }

  if (template && typeof template === "object") {
    return Object.fromEntries(
      Object.entries(template)
        .map(([key, value]) => [key, applyTemplate(value, values)])
        .filter(([, value]) => value !== "" && value !== undefined && value !== null),
    );
  }

  return template;
}

function buildInitialValues(tool: AutomationCompanyTool, companySlug: string | null) {
  return Object.fromEntries(
    tool.fields.map((field) => [
      field.id,
      field.id === "companySlug" && companySlug ? companySlug : field.defaultValue ?? (field.type === "switch" ? false : ""),
    ]),
  ) as Record<string, string | number | boolean>;
}

function companyLabel(companySlug: string | null, companies: CompanyOption[]) {
  if (!companySlug) return "Contexto atual";
  return companies.find((company) => company.slug === companySlug)?.name ?? companySlug;
}

function buildEnvironmentHeaders(environment: (typeof AUTOMATION_ENVIRONMENTS)[number], token: string) {
  if (!environment.requiresToken) return {};

  const trimmedToken = token.trim();
  if (!trimmedToken) return {};

  const headerName = environment.tokenHeaderName ?? "Authorization";
  const prefix = environment.tokenPrefix ? `${environment.tokenPrefix} ` : "";
  return {
    [headerName]: `${prefix}${trimmedToken}`,
  };
}

function buildEnvironmentPreviewHeaders(environment: (typeof AUTOMATION_ENVIRONMENTS)[number]) {
  if (!environment.requiresToken) return {};

  const headerName = environment.tokenHeaderName ?? "Authorization";
  const prefix = environment.tokenPrefix ? `${environment.tokenPrefix} ` : "";
  return {
    [headerName]: `${prefix}<token>`,
  };
}

function resolveEnvironmentBaseUrl(environment: (typeof AUTOMATION_ENVIRONMENTS)[number], configuredBaseUrl: string) {
  return environment.requiresBaseUrl ? configuredBaseUrl.trim() : environment.baseUrl;
}

function JsonHighlight({ json }: { json: string }) {
  const parts: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g;
  let cursor = 0;
  let idx = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(json)) !== null) {
    if (m.index > cursor) {
      parts.push(
        <span key={idx++} className="text-slate-900 dark:text-[#d4d4d4]">
          {json.slice(cursor, m.index)}
        </span>,
      );
    }
    if (m[1] != null) {
      parts.push(<span key={idx++} className="text-[#0451a5] dark:text-[#9CDCFE]">{m[1]}</span>);
      const after = m[0].slice(m[1].length);
      if (after) parts.push(<span key={idx++} className="text-slate-900 dark:text-[#d4d4d4]">{after}</span>);
    } else if (m[2] != null) {
      parts.push(<span key={idx++} className="text-[#a31515] dark:text-[#ce9178]">{m[2]}</span>);
    } else if (m[3] != null) {
      parts.push(<span key={idx++} className="text-[#0000ff] dark:text-[#569cd6]">{m[3]}</span>);
    } else if (m[4] != null) {
      parts.push(<span key={idx++} className="text-[#098658] dark:text-[#b5cea8]">{m[4]}</span>);
    } else {
      parts.push(<span key={idx++} className="text-slate-900 dark:text-[#d4d4d4]">{m[5]}</span>);
    }
    cursor = re.lastIndex;
  }
  if (cursor < json.length) {
    parts.push(
      <span key={idx} className="text-slate-900 dark:text-[#d4d4d4]">
        {json.slice(cursor)}
      </span>,
    );
  }
  return <>{parts}</>;
}

export default function AutomationCompanyTools({ access, activeCompanySlug, companies }: Props) {
  const effectiveCompanySlug = activeCompanySlug ?? null;

  const [query, setQuery] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    isTestingCompanyScope(effectiveCompanySlug) ? "qc-local" : (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local"),
  );
  const [selectedToolId, setSelectedToolId] = useState(
    AUTOMATION_COMPANY_TOOLS.find((tool) => matchesAutomationCompanyScope(tool.companySlug, effectiveCompanySlug))?.id ?? "",
  );
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [environmentBaseUrls, setEnvironmentBaseUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      AUTOMATION_ENVIRONMENTS.map((environment) => [environment.id, environment.requiresBaseUrl ? "" : environment.baseUrl]),
    ),
  );
  const [environmentTokens, setEnvironmentTokens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResponse | null>(null);
  const [resultTab, setResultTab] = useState<"summary" | "json" | "raw">("summary");

  const visibleTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return AUTOMATION_COMPANY_TOOLS.filter((tool) => {
      if (effectiveCompanySlug && !matchesAutomationCompanyScope(tool.companySlug, effectiveCompanySlug)) return false;
      if (!normalizedQuery) return true;
      return `${tool.title} ${tool.summary} ${tool.group}`.toLowerCase().includes(normalizedQuery);
    });
  }, [effectiveCompanySlug, query]);

  const visiblePresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return AUTOMATION_API_PRESETS.filter((preset) => {
      if (effectiveCompanySlug && !matchesAutomationCompanyScope(preset.companyScope, effectiveCompanySlug)) return false;
      if (!normalizedQuery) return true;
      return `${preset.title} ${preset.path} ${preset.tags.join(" ")}`.toLowerCase().includes(normalizedQuery);
    });
  }, [effectiveCompanySlug, query]);

  const selectedTool = useMemo(
    () => visibleTools.find((tool) => tool.id === selectedToolId) ?? visibleTools[0] ?? null,
    [selectedToolId, visibleTools],
  );

  useEffect(() => {
    if (!selectedTool && visibleTools[0]) {
      setSelectedToolId(visibleTools[0].id);
    }
  }, [selectedTool, visibleTools]);

  useEffect(() => {
    setSelectedEnvironmentId((current) => {
      if (isTestingCompanyScope(effectiveCompanySlug)) {
        return current === "qc-local" ? current : "qc-local";
      }
      return current === "qc-local" ? (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local") : current;
    });
  }, [effectiveCompanySlug]);

  useEffect(() => {
    if (!selectedTool) {
      setValues({});
      return;
    }
    setValues(buildInitialValues(selectedTool, effectiveCompanySlug));
  }, [effectiveCompanySlug, selectedTool]);

  useEffect(() => {
    if (!selectedTool) return;
    setValues((current) => {
      let changed = false;
      const next = { ...current };

      for (const field of selectedTool.fields) {
        if (field.type !== "select") continue;
        const options = field.options ?? [];
        if (options.length === 0) {
          if (next[field.id] !== "") {
            next[field.id] = "";
            changed = true;
          }
          continue;
        }

        const value = String(next[field.id] ?? "");
        const hasValue = options.some((option) => option.value === value);
        if (!hasValue) {
          next[field.id] = options[0].value;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [selectedTool]);

  const currentEnvironment =
    AUTOMATION_ENVIRONMENTS.find((environment) => environment.id === selectedEnvironmentId) ?? AUTOMATION_ENVIRONMENTS[0];
  const currentEnvironmentBaseUrl = resolveEnvironmentBaseUrl(currentEnvironment, environmentBaseUrls[selectedEnvironmentId] ?? "");
  const currentEnvironmentToken = environmentTokens[selectedEnvironmentId] ?? "";
  const currentEnvironmentRequirements = describeAutomationEnvironmentRequirements(currentEnvironment);

  const selectedCompany = effectiveCompanySlug ? companyLabel(effectiveCompanySlug, companies) : "Todas as empresas";

  async function executeTool() {
    if (!selectedTool) return;

    for (const field of selectedTool.fields) {
      const currentValue = values[field.id];
      if (field.required && (currentValue === "" || currentValue === undefined || currentValue === null)) {
        setErrorMessage(`Preencha ${field.label}.`);
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      if (selectedTool.mode === "internal") {
        const payload = applyTemplate(selectedTool.bodyTemplate, values);
        const response = await fetch(selectedTool.internalPath!, {
          method: selectedTool.method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json?.error || "Falha ao executar a tool.");
        }

        setResult({
          json,
          status: response.status,
          statusText: response.statusText,
          text: JSON.stringify(json, null, 2),
          url: selectedTool.internalPath!,
          ...(json?.result ?? {}),
        });
        return;
      }

      const path = String(applyTemplate(selectedTool.pathTemplate, values));
      const environmentBaseUrl = resolveEnvironmentBaseUrl(currentEnvironment, environmentBaseUrls[selectedEnvironmentId] ?? "");
      if (currentEnvironment.requiresBaseUrl) {
        if (!environmentBaseUrl) {
          setErrorMessage("Informe a URL base do ambiente selecionado.");
          setLoading(false);
          return;
        }
        if (!/^https?:\/\//i.test(environmentBaseUrl)) {
          setErrorMessage("A URL base precisa começar com http:// ou https://.");
          setLoading(false);
          return;
        }
      }

      const environmentToken = currentEnvironmentToken.trim();
      if (currentEnvironment.requiresToken && !environmentToken) {
        setErrorMessage("Informe o token do ambiente selecionado.");
        setLoading(false);
        return;
      }

      const environmentHeaders = buildEnvironmentHeaders(currentEnvironment, environmentToken);

      const execution = await fetch("/api/automations/http", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
          body: JSON.stringify({
            headers: {
              ...(selectedTool.headers ?? {}),
              ...environmentHeaders,
            },
            companySlug: effectiveCompanySlug,
            method: selectedTool.method,
            timeoutMs: 15000,
            url: normalizeBaseUrl(environmentBaseUrl || currentEnvironment.baseUrl, path),
          }),
        });
      const payload = await execution.json();

      if (!execution.ok || !payload?.response) {
        throw new Error(payload?.error || "Falha ao executar a tool.");
      }

      setResult(payload.response as ToolResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao executar a tool.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    const content =
      resultTab === "summary"
        ? JSON.stringify(
            Object.fromEntries(selectedTool?.responseFocus.map((key) => [key, result[key]]) ?? []),
            null,
            2,
          )
        : resultTab === "json"
          ? JSON.stringify(result.json ?? {}, null, 2)
          : String(result.text ?? "");
    await navigator.clipboard.writeText(content);
    setCopyFeedback("Resultado copiado");
    window.setTimeout(() => setCopyFeedback(null), 1400);
  }

  return (
    <section className="space-y-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-[#011848] dark:text-zinc-100">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#011848] dark:text-zinc-100">
            <FiTool className="h-4 w-4 text-[#ef0001]" />
            Tools
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#011848] dark:text-zinc-100">
            <FiShield className="h-4 w-4 text-[#ef0001]" />
            {selectedCompany}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#011848] dark:text-zinc-100">
            <FiGrid className="h-4 w-4 text-[#ef0001]" />
            {access.profileLabel}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-0">
            <select
              aria-label="Ambiente de execução"
              value={selectedEnvironmentId}
              onChange={(event) => setSelectedEnvironmentId(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-800 outline-none dark:text-zinc-100"
            >
              {AUTOMATION_ENVIRONMENTS.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.title}
                </option>
              ))}
            </select>
            <p className="mt-1 max-w-[24rem] text-[11px] leading-4 text-slate-500 dark:text-zinc-400">
              {currentEnvironmentRequirements}
            </p>
            <p className="mt-0.5 max-w-[24rem] text-[11px] leading-4 text-slate-500 dark:text-zinc-400">
              {currentEnvironment.note}
            </p>
            {currentEnvironment.requiresBaseUrl || currentEnvironment.requiresToken ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {currentEnvironment.requiresBaseUrl ? (
                  <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">
                    URL base
                    <input
                      value={environmentBaseUrls[selectedEnvironmentId] ?? ""}
                      onChange={(event) =>
                        setEnvironmentBaseUrls((current) => ({
                          ...current,
                          [selectedEnvironmentId]: event.target.value,
                        }))
                      }
                      placeholder="Digite a URL base"
                      className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:border-zinc-800 dark:bg-[#081227] dark:text-white dark:placeholder:text-zinc-500"
                    />
                  </label>
                ) : null}
                {currentEnvironment.requiresToken ? (
                  <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">
                    Token
                    <input
                      type="password"
                      value={environmentTokens[selectedEnvironmentId] ?? ""}
                      onChange={(event) =>
                        setEnvironmentTokens((current) => ({
                          ...current,
                          [selectedEnvironmentId]: event.target.value,
                        }))
                      }
                      placeholder="Cole o token"
                      className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:border-zinc-800 dark:bg-[#081227] dark:text-white dark:placeholder:text-zinc-500"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={executeTool}
            disabled={loading || !selectedTool}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#011848] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <FiPlay className="h-4 w-4" />
            {loading ? "Executando" : "Rodar"}
          </button>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-14rem)] items-stretch gap-4 xl:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)_minmax(18rem,20rem)]">
        <aside className="min-h-0 min-w-0 rounded-[18px] border border-slate-200 bg-slate-50 p-3 xl:sticky xl:top-6 xl:self-stretch">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tool ou preset"
              className="min-h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none"
            />
          </label>

          {visibleTools.length > 0 ? (
            <div className="mt-3 space-y-2">
              {visibleTools.map((tool) => {
                const active = selectedTool?.id === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setSelectedToolId(tool.id)}
                    className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      active ? "border-[#ef0001] bg-white" : "border-slate-200 bg-white/70 hover:border-slate-300"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#011848] dark:text-zinc-100">{tool.title}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                        {tool.group} â€¢ {tool.method}
                      </p>
                    </div>
                    <FiServer className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-[#ef0001]" : "text-slate-400 group-hover:text-[#ef0001]"}`} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white/70 p-4">
              <p className="text-sm font-semibold text-[#011848] dark:text-zinc-100">Sem tools especificas para este contexto</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                Abaixo aparecem presets compartilhados e fluxos sugeridos para vocÃª nao ficar sem acao.
              </p>
              <div className="mt-3 space-y-2">
                {visiblePresets.slice(0, 3).map((preset) => (
                  <div key={preset.id} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="truncate text-sm font-semibold text-[#011848] dark:text-zinc-100">{preset.title}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-zinc-500">
                      {preset.method} {preset.path}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <article className="min-h-0 min-w-0 rounded-[18px] border border-slate-200 bg-white p-4">
          {selectedTool ? (
            <>
              <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ef0001]">Tool ativa</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#011848] dark:text-zinc-100">{selectedTool.title}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">{selectedTool.summary}</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedTool.fields.map((field) => (
                  <label
                    key={field.id}
                    className={`grid gap-2 text-sm font-semibold text-[#011848] dark:text-zinc-100 ${field.type === "textarea" ? "md:col-span-2" : ""}`}
                  >
                    {field.label}
                    {field.type === "select" ? (
                      <select
                        value={String(values[field.id] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        disabled={(field.options ?? []).length === 0}
                        className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                      >
                        {(field.options ?? []).length === 0 ? (
                          <option value="">Sem opcoes disponiveis</option>
                        ) : (
                          (field.options ?? []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))
                        )}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        value={String(values[field.id] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        rows={4}
                        placeholder={field.placeholder}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                      />
                    ) : field.type === "switch" ? (
                      <button
                        type="button"
                        onClick={() => setValues((current) => ({ ...current, [field.id]: !Boolean(current[field.id]) }))}
                        className={`inline-flex min-h-11 items-center justify-between rounded-xl border px-4 py-2 text-sm font-semibold ${
                          Boolean(values[field.id])
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500 dark:text-zinc-500"
                        }`}
                      >
                        <span>{Boolean(values[field.id]) ? "Ativo" : "Desligado"}</span>
                        <FiCheckCircle className="h-4 w-4" />
                      </button>
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={String(values[field.id] ?? "")}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.id]: coerceFieldValue(event.target.value, field.type),
                          }))
                        }
                        placeholder={field.placeholder}
                        className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-zinc-800 dark:bg-[#081227] dark:text-white">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-white/70">
                  <FiServer className="h-4 w-4" />
                  Request gerada
                </div>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-900 dark:border-zinc-800 dark:bg-transparent dark:text-white">
                  <JsonHighlight json={selectedTool.mode === "internal"
                    ? JSON.stringify(applyTemplate(selectedTool.bodyTemplate, values), null, 2)
                    : JSON.stringify(
                        {
                          ...(selectedTool.headers ?? {}),
                          ...buildEnvironmentPreviewHeaders(currentEnvironment),
                          method: selectedTool.method,
                          url: normalizeBaseUrl(
                            currentEnvironment.requiresBaseUrl ? currentEnvironmentBaseUrl : currentEnvironment.baseUrl,
                            String(applyTemplate(selectedTool.pathTemplate, values)),
                          ),
                        },
                        null,
                        2,
                      )} />
                </pre>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ef0001]">Hub de ferramentas</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#011848] dark:text-zinc-100">
                  {effectiveCompanySlug ? `Ferramentas para ${selectedCompany}` : "Ferramentas compartilhadas"}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                  Quando nao existe uma ferramenta especifica vinculada ao contexto atual, a tela continua util com
                  presets de API e fluxos sugeridos.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-zinc-500">
                    Presets compartilhados
                  </p>
                  <span className="text-xs text-slate-500 dark:text-zinc-500">{visiblePresets.length} itens</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visiblePresets.length > 0 ? (
                    visiblePresets.map((preset) => (
                      <div key={preset.id} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-sm font-semibold text-[#011848] dark:text-zinc-100">{preset.title}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                          {preset.method} â€¢ {preset.path}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {preset.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500 dark:text-zinc-500 sm:col-span-2">
                      Nenhum preset ficou visivel para este contexto.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-zinc-500">
                    Fluxos sugeridos
                  </p>
                  <span className="text-xs text-slate-500 dark:text-zinc-500">{AUTOMATION_FLOWS.length} fluxos</span>
                </div>
                <div className="space-y-2">
                  {AUTOMATION_FLOWS.slice(0, 3).map((flow) => (
                    <div key={flow.id} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#011848] dark:text-zinc-100">{flow.title}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-zinc-500">{flow.audience}</p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                          {flow.stack}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">{flow.objective}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </article>

        <aside className="min-h-0 min-w-0 rounded-[18px] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-500">Resultado</p>
            <button
              type="button"
              aria-label="Copiar resultado"
              title="Copiar resultado"
              onClick={copyResult}
              disabled={!result}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#011848] dark:text-zinc-100 disabled:opacity-40"
            >
              <FiCopy className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Status</p>
              <p className="mt-1 text-sm font-semibold text-[#011848] dark:text-zinc-100">
                {result?.status ? `${result.status} ${result.statusText ?? ""}` : "--"}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Duracao</p>
              <p className="mt-1 text-sm font-semibold text-[#011848] dark:text-zinc-100">
                {typeof result?.durationMs === "number" ? `${result.durationMs} ms` : "--"}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Tipo</p>
              <p className="mt-1 text-sm font-semibold text-[#011848] dark:text-zinc-100">
                {selectedTool?.mode === "internal" ? "Runner interno" : "Proxy HTTP"}
              </p>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700">
              {errorMessage}
            </div>
          ) : null}
          {copyFeedback ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
              {copyFeedback}
            </div>
          ) : null}

          <div className="mt-4 inline-flex max-w-full flex-wrap rounded-xl border border-slate-200 bg-white p-1">
            {[
              { id: "summary", label: "Resumo" },
              { id: "json", label: "JSON" },
              { id: "raw", label: "Raw" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setResultTab(tab.id as typeof resultTab)}
                className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${
                  resultTab === tab.id ? "bg-slate-50 text-[#ef0001]" : "text-slate-500 dark:text-zinc-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#081227]">
            <pre className="overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-900 dark:border-zinc-800 dark:bg-transparent dark:text-white">
              {resultTab === "raw"
                ? <span className="text-slate-900 dark:text-[#d4d4d4]">{String(result?.text ?? "")}</span>
                : <JsonHighlight json={resultTab === "summary"
                    ? JSON.stringify(Object.fromEntries(selectedTool?.responseFocus.map((key) => [key, result?.[key]]) ?? []), null, 2)
                    : JSON.stringify(result?.json ?? null, null, 2)
                  } />}
            </pre>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
            <FiActivity className="h-4 w-4" />
            Tool pronta para operacao rapida por empresa.
          </div>
        </aside>
      </div>
    </section>
  );
}

