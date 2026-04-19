"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiCheckCircle,
  FiCopy,
  FiGlobe,
  FiGrid,
  FiPlay,
  FiSearch,
  FiServer,
  FiShield,
  FiTool,
} from "react-icons/fi";

import type { AutomationAccess } from "@/lib/automations/access";
import { AUTOMATION_ENVIRONMENTS } from "@/data/automationCatalog";
import { AUTOMATION_COMPANY_TOOLS, type AutomationCompanyTool } from "@/data/automationIde";
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

function coerceFieldValue(value: string | number | boolean | undefined, type: AutomationCompanyTool["fields"][number]["type"]): string | number | boolean {
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

function buildInitialValues(tool: AutomationCompanyTool, activeCompanySlug: string | null) {
  return Object.fromEntries(
    tool.fields.map((field) => [
      field.id,
      field.id === "companySlug" && activeCompanySlug ? activeCompanySlug : field.defaultValue ?? (field.type === "switch" ? false : ""),
    ]),
  ) as Record<string, string | number | boolean>;
}

export default function AutomationCompanyTools({ access, activeCompanySlug, companies }: Props) {
  const [query, setQuery] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(isTestingCompanyScope(activeCompanySlug) ? "qc-local" : (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local"));
  const [selectedToolId, setSelectedToolId] = useState(
    AUTOMATION_COMPANY_TOOLS.find((tool) => matchesAutomationCompanyScope(tool.companySlug, activeCompanySlug))?.id ?? "",
  );
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResponse | null>(null);
  const [resultTab, setResultTab] = useState<"summary" | "json" | "raw">("summary");

  const visibleTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return AUTOMATION_COMPANY_TOOLS.filter((tool) => {
      if (!matchesAutomationCompanyScope(tool.companySlug, activeCompanySlug)) return false;
      if (!normalizedQuery) return true;
      return `${tool.title} ${tool.summary} ${tool.group}`.toLowerCase().includes(normalizedQuery);
    });
  }, [activeCompanySlug, query]);

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
      if (isTestingCompanyScope(activeCompanySlug)) {
        return current === "qc-local" ? current : "qc-local";
      }

      return current === "qc-local" ? (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local") : current;
    });
  }, [activeCompanySlug]);

  useEffect(() => {
    if (!selectedTool) {
      setValues({});
      return;
    }
    setValues(buildInitialValues(selectedTool, activeCompanySlug));
  }, [activeCompanySlug, selectedTool]);

  const currentEnvironment = useMemo(
    () => AUTOMATION_ENVIRONMENTS.find((environment) => environment.id === selectedEnvironmentId) ?? AUTOMATION_ENVIRONMENTS[0],
    [selectedEnvironmentId],
  );

  const selectedCompany = companies.find((company) => company.slug === activeCompanySlug) ?? companies[0] ?? null;

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
      const execution = await fetch("/api/automations/http", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          headers: selectedTool.headers ?? {},
          method: selectedTool.method,
          timeoutMs: 15000,
          url: normalizeBaseUrl(currentEnvironment.baseUrl, path),
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
            Object.fromEntries(
              selectedTool?.responseFocus.map((key) => [key, result[key]]) ?? [],
            ),
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
    <section className="space-y-4 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiTool className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            Tools
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {selectedCompany?.name || activeCompanySlug || "Empresa"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiGrid className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {access.profileLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            <FiGlobe className="h-4 w-4" />
            {currentEnvironment?.title}
          </div>
          <button
            type="button"
            onClick={executeTool}
            disabled={loading || !selectedTool}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <FiPlay className="h-4 w-4" />
            {loading ? "Executando" : "Rodar"}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <aside className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 xl:col-span-4 xl:sticky xl:top-6 2xl:col-span-3">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tool"
              className="min-h-10 w-full rounded-xl border border-(--tc-border,#d7deea) bg-white pr-4 pl-10 text-sm outline-none"
            />
          </label>
          <div className="mt-3 space-y-2">
            {visibleTools.map((tool) => {
              const active = selectedTool?.id === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setSelectedToolId(tool.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left ${active ? "border-(--tc-accent,#ef0001) bg-white" : "border-(--tc-border,#d7deea) bg-white/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{tool.title}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                        {tool.group} • {tool.method}
                      </p>
                    </div>
                    <FiServer className="mt-0.5 h-4 w-4 shrink-0 text-(--tc-accent,#ef0001)" />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 xl:col-span-8 2xl:col-span-5">
          {selectedTool ? (
            <>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-accent,#ef0001)">Tool ativa</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedTool.title}</h2>
                  <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{selectedTool.summary}</p>
                </div>
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
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedTool.fields.map((field) => (
                  <label key={field.id} className={`grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
                    {field.label}
                    {field.type === "select" ? (
                      <select
                        value={String(values[field.id] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        value={String(values[field.id] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        rows={4}
                        placeholder={field.placeholder}
                        className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm outline-none"
                      />
                    ) : field.type === "switch" ? (
                      <button
                        type="button"
                        onClick={() => setValues((current) => ({ ...current, [field.id]: !Boolean(current[field.id]) }))}
                        className={`inline-flex min-h-11 items-center justify-between rounded-xl border px-4 py-2 text-sm font-semibold ${
                          Boolean(values[field.id]) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280)"
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
                        className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="mt-4 rounded-[16px] border border-(--tc-border,#d7deea) bg-[#081227] p-4 text-white">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  <FiServer className="h-4 w-4" />
                  Request gerada
                </div>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white/88">
                  {selectedTool.mode === "internal"
                    ? JSON.stringify(applyTemplate(selectedTool.bodyTemplate, values), null, 2)
                    : JSON.stringify(
                        {
                          method: selectedTool.method,
                          url: normalizeBaseUrl(currentEnvironment.baseUrl, String(applyTemplate(selectedTool.pathTemplate, values))),
                        },
                        null,
                        2,
                      )}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-(--tc-border,#d7deea) px-4 py-6 text-sm text-(--tc-text-muted,#6b7280)">
              Nenhuma tool disponível para a empresa atual.
            </div>
          )}
        </article>

        <aside className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 xl:col-span-12 2xl:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Resultado</p>
            <button
              type="button"
              onClick={copyResult}
              disabled={!result}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c) disabled:opacity-40"
            >
              <FiCopy className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Status</p>
              <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">{result?.status ? `${result.status} ${result.statusText ?? ""}` : "--"}</p>
            </div>
            <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Duração</p>
              <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">{typeof result?.durationMs === "number" ? `${result.durationMs} ms` : "--"}</p>
            </div>
            <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Tipo</p>
              <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">{selectedTool?.mode === "internal" ? "Runner interno" : "Proxy HTTP"}</p>
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
              { id: "summary", label: "Resumo" },
              { id: "json", label: "JSON" },
              { id: "raw", label: "Raw" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setResultTab(tab.id as typeof resultTab)}
                className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${resultTab === tab.id ? "bg-(--tc-surface-2,#f8fafc) text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280)"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-[420px] rounded-[16px] border border-(--tc-border,#d7deea) bg-[#081227] p-4">
            <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white">
              {resultTab === "summary"
                ? JSON.stringify(
                    Object.fromEntries(selectedTool?.responseFocus.map((key) => [key, result?.[key]]) ?? []),
                    null,
                    2,
                  )
                : resultTab === "json"
                  ? JSON.stringify(result?.json ?? null, null, 2)
                  : String(result?.text ?? "")}
            </pre>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-(--tc-text-muted,#6b7280)">
            <FiActivity className="h-4 w-4" />
            Tool pronta para operação rápida por empresa.
          </div>
        </aside>
      </div>
    </section>
  );
}
