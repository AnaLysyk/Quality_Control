"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  FiClock,
  FiCopy,
  FiDatabase,
  FiGlobe,
  FiKey,
  FiLock,
  FiPlay,
  FiPlus,
  FiSave,
  FiServer,
  FiShield,
  FiSliders,
  FiTrash2,
} from "react-icons/fi";

import { AUTOMATION_ENVIRONMENTS } from "@/data/automationCatalog";
import {
  AUTOMATION_API_PRESETS,
  AUTOMATION_IDE_METHODS,
  type AutomationHttpMethod,
  type AutomationRequestAuth,
  type AutomationRequestKeyValue,
  type AutomationRequestPreset,
} from "@/data/automationIde";
import { isTestingCompanyScope, matchesAutomationCompanyScope } from "@/lib/automations/companyScope";

type CompanyOption = {
  name: string;
  slug: string;
};

type Props = {
  activeCompanySlug: string | null;
  companies: CompanyOption[];
};

type KeyValueRow = AutomationRequestKeyValue & {
  id: string;
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

type EditorPanel = "params" | "auth" | "variables" | "headers" | "body";

const REQUEST_STORAGE_PREFIX = "qc:automation:api-lab:v2";
const ENV_STORAGE_PREFIX = "qc:automation:api-lab:env:v1";
const DEFAULT_AUTH: AutomationRequestAuth = { type: "none" };

function createKeyValueRow(seed?: Partial<AutomationRequestKeyValue>): KeyValueRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    key: seed?.key ?? "",
    value: seed?.value ?? "",
  };
}

function buildKeyValueRows(items?: AutomationRequestKeyValue[]) {
  return items && items.length > 0 ? items.map((item) => createKeyValueRow(item)) : [createKeyValueRow()];
}

function sanitizeKeyValueRows(rows: KeyValueRow[]): AutomationRequestKeyValue[] {
  return rows
    .map((row) => ({
      key: row.key.trim(),
      value: row.value,
    }))
    .filter((row) => row.key.length > 0);
}

function updateKeyValueRow(
  setter: Dispatch<SetStateAction<KeyValueRow[]>>,
  rowId: string,
  field: keyof AutomationRequestKeyValue,
  value: string,
) {
  setter((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
}

function appendKeyValueRow(setter: Dispatch<SetStateAction<KeyValueRow[]>>, seed?: Partial<AutomationRequestKeyValue>) {
  setter((current) => [...current, createKeyValueRow(seed)]);
}

function removeKeyValueRow(setter: Dispatch<SetStateAction<KeyValueRow[]>>, rowId: string) {
  setter((current) => (current.length === 1 ? [createKeyValueRow()] : current.filter((row) => row.id !== rowId)));
}

function normalizeBaseUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

function storageKey(companySlug: string | null) {
  return `${REQUEST_STORAGE_PREFIX}:${companySlug ?? "global"}`;
}

function environmentStorageKey(companySlug: string | null, environmentId: string) {
  return `${ENV_STORAGE_PREFIX}:${companySlug ?? "global"}:${environmentId}`;
}

function buildAuthState(auth?: AutomationRequestAuth): AutomationRequestAuth {
  return {
    ...DEFAULT_AUTH,
    ...auth,
  };
}

function resolveTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(.+?)\}\}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] ?? "" : `{{${key}}}`;
  });
}

function collectTemplateKeys(template: string) {
  const matches = template.match(/\{\{(.+?)\}\}/g) ?? [];
  return matches.map((item) => item.slice(2, -2).trim()).filter(Boolean);
}

function buildResolvedUrl(
  baseUrl: string,
  path: string,
  queryParams: AutomationRequestKeyValue[],
  auth: AutomationRequestAuth,
  variables: Record<string, string>,
) {
  const resolvedPath = resolveTemplate(path, variables);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, resolvedPath);
  const canUseNativeUrl = /^https?:\/\//i.test(normalizedBaseUrl);
  const targetUrl = canUseNativeUrl ? new URL(normalizedBaseUrl) : null;
  const previewQuery = new URLSearchParams();

  for (const query of queryParams) {
    const key = resolveTemplate(query.key, variables).trim();
    if (!key) continue;
    if (targetUrl) {
      targetUrl.searchParams.set(key, resolveTemplate(query.value, variables));
    } else {
      previewQuery.set(key, resolveTemplate(query.value, variables));
    }
  }

  if (auth.type === "api-key" && auth.addTo === "query") {
    const key = resolveTemplate(auth.key ?? "", variables).trim();
    if (key) {
      if (targetUrl) {
        targetUrl.searchParams.set(key, resolveTemplate(auth.value ?? "", variables));
      } else {
        previewQuery.set(key, resolveTemplate(auth.value ?? "", variables));
      }
    }
  }

  if (targetUrl) {
    return targetUrl.toString();
  }

  const querySuffix = previewQuery.toString();
  return querySuffix ? `${normalizedBaseUrl}?${querySuffix}` : normalizedBaseUrl;
}

function buildSystemVariables(input: {
  activeCompanySlug: string | null;
  companyName: string;
  currentEnvironmentId: string;
  currentEnvironmentTitle: string;
  currentEnvironmentBaseUrl: string;
}) {
  return [
    { key: "companySlug", value: input.activeCompanySlug ?? "" },
    { key: "companyName", value: input.companyName },
    { key: "environment", value: input.currentEnvironmentId },
    { key: "environmentTitle", value: input.currentEnvironmentTitle },
    { key: "baseUrl", value: input.currentEnvironmentBaseUrl },
  ];
}

function encodeBasicAuth(username: string, password: string) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function authLabel(auth: AutomationRequestAuth) {
  if (auth.type === "bearer") return "Bearer";
  if (auth.type === "basic") return "Basic";
  if (auth.type === "api-key") return "API Key";
  if (auth.type === "session") return "Sessão atual";
  return "Sem autenticação";
}

export default function AutomationApiLab({ activeCompanySlug, companies }: Props) {
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    isTestingCompanyScope(activeCompanySlug) ? "qc-local" : (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local"),
  );
  const [selectedPresetId, setSelectedPresetId] = useState(AUTOMATION_API_PRESETS[0]?.id ?? "scratch");
  const [requestName, setRequestName] = useState(AUTOMATION_API_PRESETS[0]?.title ?? "Request");
  const [method, setMethod] = useState<AutomationHttpMethod>(AUTOMATION_API_PRESETS[0]?.method ?? "GET");
  const [path, setPath] = useState(AUTOMATION_API_PRESETS[0]?.path ?? "/api/health");
  const [body, setBody] = useState(AUTOMATION_API_PRESETS[0]?.body ?? "");
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>(buildKeyValueRows(AUTOMATION_API_PRESETS[0]?.headers ?? []));
  const [queryRows, setQueryRows] = useState<KeyValueRow[]>(buildKeyValueRows(AUTOMATION_API_PRESETS[0]?.queryParams ?? []));
  const [localVariableRows, setLocalVariableRows] = useState<KeyValueRow[]>(buildKeyValueRows(AUTOMATION_API_PRESETS[0]?.variables ?? []));
  const [environmentVariableRows, setEnvironmentVariableRows] = useState<KeyValueRow[]>([createKeyValueRow()]);
  const [auth, setAuth] = useState<AutomationRequestAuth>(buildAuthState(AUTOMATION_API_PRESETS[0]?.auth));
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<HttpResponseState | null>(null);
  const [responseTab, setResponseTab] = useState<"json" | "raw" | "headers">("json");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<EditorPanel>("params");

  const selectedCompany = useMemo(
    () => companies.find((company) => company.slug === activeCompanySlug) ?? companies[0] ?? null,
    [activeCompanySlug, companies],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey(activeCompanySlug));
      if (!raw) {
        setSavedRequests([]);
        return;
      }

      const parsed = JSON.parse(raw) as SavedRequest[];
      if (Array.isArray(parsed)) {
        setSavedRequests(parsed);
      }
    } catch {
      setSavedRequests([]);
    }
  }, [activeCompanySlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(environmentStorageKey(activeCompanySlug, selectedEnvironmentId));
      if (!raw) {
        setEnvironmentVariableRows([createKeyValueRow()]);
        return;
      }

      const parsed = JSON.parse(raw) as AutomationRequestKeyValue[];
      setEnvironmentVariableRows(buildKeyValueRows(Array.isArray(parsed) ? parsed : []));
    } catch {
      setEnvironmentVariableRows([createKeyValueRow()]);
    }
  }, [activeCompanySlug, selectedEnvironmentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      environmentStorageKey(activeCompanySlug, selectedEnvironmentId),
      JSON.stringify(sanitizeKeyValueRows(environmentVariableRows)),
    );
  }, [activeCompanySlug, selectedEnvironmentId, environmentVariableRows]);

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

  const systemVariables = useMemo(
    () =>
      buildSystemVariables({
        activeCompanySlug,
        companyName: selectedCompany?.name ?? "",
        currentEnvironmentBaseUrl: currentEnvironment.baseUrl,
        currentEnvironmentId: currentEnvironment.id,
        currentEnvironmentTitle: currentEnvironment.title,
      }),
    [activeCompanySlug, currentEnvironment.baseUrl, currentEnvironment.id, currentEnvironment.title, selectedCompany?.name],
  );

  const resolvedVariables = useMemo(() => {
    const registry = Object.fromEntries(systemVariables.map((item) => [item.key, item.value]));

    for (const row of sanitizeKeyValueRows(environmentVariableRows)) {
      registry[row.key] = row.value;
    }

    for (const row of sanitizeKeyValueRows(localVariableRows)) {
      registry[row.key] = row.value;
    }

    return registry;
  }, [environmentVariableRows, localVariableRows, systemVariables]);

  const missingVariableKeys = useMemo(() => {
    const referenced = new Set<string>();

    collectTemplateKeys(path).forEach((key) => referenced.add(key));
    collectTemplateKeys(body).forEach((key) => referenced.add(key));

    for (const row of [...headerRows, ...queryRows, ...localVariableRows, ...environmentVariableRows]) {
      collectTemplateKeys(row.key).forEach((key) => referenced.add(key));
      collectTemplateKeys(row.value).forEach((key) => referenced.add(key));
    }

    if (auth.type === "bearer" || auth.type === "api-key") {
      collectTemplateKeys(auth.value ?? "").forEach((key) => referenced.add(key));
    }

    if (auth.type === "api-key") {
      collectTemplateKeys(auth.key ?? "").forEach((key) => referenced.add(key));
    }

    if (auth.type === "basic") {
      collectTemplateKeys(auth.username ?? "").forEach((key) => referenced.add(key));
      collectTemplateKeys(auth.password ?? "").forEach((key) => referenced.add(key));
    }

    return Array.from(referenced).filter((key) => !Object.prototype.hasOwnProperty.call(resolvedVariables, key));
  }, [auth, body, environmentVariableRows, headerRows, localVariableRows, path, queryRows, resolvedVariables]);

  const resolvedUrlPreview = useMemo(
    () =>
      buildResolvedUrl(
        currentEnvironment.baseUrl,
        path,
        sanitizeKeyValueRows(queryRows),
        auth,
        resolvedVariables,
      ),
    [auth, currentEnvironment.baseUrl, path, queryRows, resolvedVariables],
  );

  function applyPreset(preset: AutomationRequestPreset | SavedRequest) {
    setSelectedPresetId(preset.id);
    setRequestName(preset.title);
    setMethod(preset.method);
    setPath(preset.path);
    setBody(preset.body);
    setHeaderRows(buildKeyValueRows(preset.headers));
    setQueryRows(buildKeyValueRows(preset.queryParams ?? []));
    setLocalVariableRows(buildKeyValueRows(preset.variables ?? []));
    setAuth(buildAuthState(preset.auth));
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
      auth,
      headers: sanitizeKeyValueRows(headerRows),
      queryParams: sanitizeKeyValueRows(queryRows),
      variables: sanitizeKeyValueRows(localVariableRows),
      companyScope: "all",
      tags: ["saved"],
      source: "saved",
    };

    persistSavedRequests([snapshot, ...savedRequests]);
    setSelectedPresetId(snapshot.id);
    setCopyFeedback("Request salvo com auth, params e variáveis");
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
      if (missingVariableKeys.length > 0) {
        throw new Error(`Defina as variáveis: ${missingVariableKeys.join(", ")}.`);
      }

      const headers = sanitizeKeyValueRows(headerRows).reduce<Record<string, string>>((accumulator, row) => {
        const key = resolveTemplate(row.key, resolvedVariables).trim();
        if (!key) return accumulator;
        accumulator[key] = resolveTemplate(row.value, resolvedVariables);
        return accumulator;
      }, {});

      if (auth.type === "bearer") {
        const token = resolveTemplate(auth.value ?? "", resolvedVariables).trim();
        if (!token) throw new Error("Informe o token Bearer.");
        headers.Authorization = `Bearer ${token}`;
      }

      if (auth.type === "basic") {
        const username = resolveTemplate(auth.username ?? "", resolvedVariables);
        const password = resolveTemplate(auth.password ?? "", resolvedVariables);
        if (!username && !password) {
          throw new Error("Informe usuário e senha para Basic Auth.");
        }
        headers.Authorization = encodeBasicAuth(username, password);
      }

      if (auth.type === "api-key" && auth.addTo !== "query") {
        const key = resolveTemplate(auth.key ?? "", resolvedVariables).trim();
        if (!key) throw new Error("Informe o nome da API Key.");
        headers[key] = resolveTemplate(auth.value ?? "", resolvedVariables);
      }

      const resolvedBody = body.trim() ? resolveTemplate(body, resolvedVariables) : null;
      const execution = await fetch("/api/automations/http", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: resolvedBody,
          forwardCookies: auth.type === "session",
          headers,
          method,
          timeoutMs: 15000,
          url: resolvedUrlPreview,
        }),
      });
      const payload = await execution.json();

      if (!execution.ok || !payload?.response) {
        throw new Error(payload?.error || "NÃ£o foi possÃ­vel executar a chamada.");
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
    const content =
      responseTab === "headers"
        ? JSON.stringify(response.headers, null, 2)
        : responseTab === "raw"
          ? response.text
          : JSON.stringify(response.json ?? response.text, null, 2);
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
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {authLabel(auth)}
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">ColeÃ§Ã£o</p>
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
                          {preset.method} {preset.tags.join(" â€¢ ")}
                        </p>
                      </div>
                      {isSaved ? <FiDatabase className="mt-0.5 h-4 w-4 shrink-0 text-(--tc-accent,#ef0001)" /> : null}
                    </div>
                  </button>
                  {isSaved ? (
                    <div className="border-t border-(--tc-border,#d7deea) px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeSavedRequest(preset.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-(--tc-text-muted,#6b7280)"
                      >
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
              MÃ©todo
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as AutomationHttpMethod)}
                className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
              >
                {AUTOMATION_IDE_METHODS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Ambiente
              <select
                value={selectedEnvironmentId}
                onChange={(event) => setSelectedEnvironmentId(event.target.value)}
                className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
              >
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

          <div className="mt-3 rounded-[16px] border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">URL resolvida</p>
            <p className="mt-1 break-all font-mono text-xs leading-6 text-white">{resolvedUrlPreview}</p>
          </div>

          {missingVariableKeys.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-700">
              VariÃ¡veis pendentes: {missingVariableKeys.join(", ")}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 rounded-[16px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-2">
            {[
              { id: "params" as const, label: "Params", icon: FiSliders },
              { id: "auth" as const, label: "Auth", icon: FiLock },
              { id: "variables" as const, label: "VariÃ¡veis", icon: FiDatabase },
              { id: "headers" as const, label: "Headers", icon: FiKey },
              { id: "body" as const, label: "Body", icon: FiServer },
            ].map((tab) => {
              const active = activePanel === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePanel(tab.id)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-(--tc-accent,#ef0001) bg-white text-(--tc-accent,#ef0001)"
                      : "border-transparent bg-transparent text-(--tc-text,#0b1a3c) hover:border-(--tc-border,#d7deea) hover:bg-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activePanel === "params" ? (
            <section className="mt-4 rounded-[16px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Query params</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Monte a query string sem editar a URL inteira.</p>
                </div>
                <button
                  type="button"
                  onClick={() => appendKeyValueRow(setQueryRows)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {queryRows.map((row) => (
                  <div key={row.id} className="grid gap-2 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
                    <input
                      value={row.key}
                      onChange={(event) => updateKeyValueRow(setQueryRows, row.id, "key", event.target.value)}
                      placeholder="param"
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                    />
                    <input
                      value={row.value}
                      onChange={(event) => updateKeyValueRow(setQueryRows, row.id, "value", event.target.value)}
                      placeholder="valor ou {{variavel}}"
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeKeyValueRow(setQueryRows, row.id)}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activePanel === "auth" ? (
            <section className="mt-4 rounded-[16px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Tipo de autenticaÃ§Ã£o
                  <select
                    value={auth.type}
                    onChange={(event) =>
                      setAuth((current) => ({
                        ...current,
                        type: event.target.value as AutomationRequestAuth["type"],
                        addTo: event.target.value === "api-key" ? current.addTo ?? "header" : current.addTo,
                      }))
                    }
                    className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer</option>
                    <option value="basic">Basic</option>
                    <option value="api-key">API Key</option>
                    <option value="session">SessÃ£o atual</option>
                  </select>
                </label>

                <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                  {auth.type === "session"
                    ? "Reaproveita os cookies da sessÃ£o atual para chamadas internas do prÃ³prio painel."
                    : auth.type === "api-key"
                      ? "A chave pode entrar em header ou query string."
                      : auth.type === "basic"
                        ? "Monta automaticamente o header Authorization Basic."
                        : auth.type === "bearer"
                          ? "Monta automaticamente o header Authorization Bearer."
                          : "A request segue sem autenticaÃ§Ã£o adicional."}
                </div>
              </div>

              {auth.type === "bearer" ? (
                <label className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Token Bearer
                  <input
                    value={auth.value ?? ""}
                    onChange={(event) => setAuth((current) => ({ ...current, value: event.target.value }))}
                    placeholder="token ou {{token}}"
                    className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
              ) : null}

              {auth.type === "basic" ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    UsuÃ¡rio
                    <input
                      value={auth.username ?? ""}
                      onChange={(event) => setAuth((current) => ({ ...current, username: event.target.value }))}
                      placeholder="user ou {{user}}"
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Senha
                    <input
                      value={auth.password ?? ""}
                      onChange={(event) => setAuth((current) => ({ ...current, password: event.target.value }))}
                      placeholder="senha ou {{password}}"
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                    />
                  </label>
                </div>
              ) : null}

              {auth.type === "api-key" ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Nome
                    <input
                      value={auth.key ?? ""}
                      onChange={(event) => setAuth((current) => ({ ...current, key: event.target.value }))}
                      placeholder="x-api-key"
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Valor
                    <input
                      value={auth.value ?? ""}
                      onChange={(event) => setAuth((current) => ({ ...current, value: event.target.value }))}
                      placeholder="valor ou {{apiKey}}"
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Inserir em
                    <select
                      value={auth.addTo ?? "header"}
                      onChange={(event) => setAuth((current) => ({ ...current, addTo: event.target.value as "header" | "query" }))}
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                    >
                      <option value="header">Header</option>
                      <option value="query">Query</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}

          {activePanel === "variables" ? (
            <section className="mt-4 grid gap-4 xl:grid-cols-2">
              <article className="rounded-[16px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">VariÃ¡veis do ambiente</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Persistidas por empresa + ambiente selecionado.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => appendKeyValueRow(setEnvironmentVariableRows)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                  >
                    <FiPlus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {environmentVariableRows.map((row) => (
                    <div key={row.id} className="grid gap-2 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
                      <input
                        value={row.key}
                        onChange={(event) => updateKeyValueRow(setEnvironmentVariableRows, row.id, "key", event.target.value)}
                        placeholder="apiKey"
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateKeyValueRow(setEnvironmentVariableRows, row.id, "value", event.target.value)}
                        placeholder="valor"
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyValueRow(setEnvironmentVariableRows, row.id)}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[16px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">VariÃ¡veis do request</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Sobrescrevem o ambiente sÃ³ nessa request.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => appendKeyValueRow(setLocalVariableRows)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                  >
                    <FiPlus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {localVariableRows.map((row) => (
                    <div key={row.id} className="grid gap-2 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
                      <input
                        value={row.key}
                        onChange={(event) => updateKeyValueRow(setLocalVariableRows, row.id, "key", event.target.value)}
                        placeholder="cpf"
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateKeyValueRow(setLocalVariableRows, row.id, "value", event.target.value)}
                        placeholder="12345678900"
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyValueRow(setLocalVariableRows, row.id)}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[16px] border border-(--tc-border,#d7deea) bg-white p-3 xl:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">VariÃ¡veis de sistema</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {systemVariables.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                    >
                      {`{{${item.key}}}`} = {item.value || "--"}
                    </span>
                  ))}
                </div>
              </article>
            </section>
          ) : null}

          {activePanel === "headers" ? (
            <section className="mt-4 rounded-[16px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Headers</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{"Pode usar placeholders como `{{token}}`."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => appendKeyValueRow(setHeaderRows)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {headerRows.map((row) => (
                  <div key={row.id} className="grid gap-2 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
                    <input
                      value={row.key}
                      onChange={(event) => updateKeyValueRow(setHeaderRows, row.id, "key", event.target.value)}
                      placeholder="Header"
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                    />
                    <input
                      value={row.value}
                      onChange={(event) => updateKeyValueRow(setHeaderRows, row.id, "value", event.target.value)}
                      placeholder="Valor"
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeKeyValueRow(setHeaderRows, row.id)}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activePanel === "body" ? (
            <label className="mt-4 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Body
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={14}
                placeholder='{"cpf":"{{cpf}}"}'
                className="rounded-[16px] border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-white outline-none"
              />
            </label>
          ) : null}
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">DuraÃ§Ã£o</p>
              <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">{response ? `${response.durationMs} ms` : "--"}</p>
            </div>
            <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">URL</p>
              <p className="mt-1 truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{response?.url ?? resolvedUrlPreview}</p>
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
            BFF interno para request com auth, params e variÃ¡veis sem abrir Postman.
          </div>
        </aside>
      </div>
    </section>
  );
}
