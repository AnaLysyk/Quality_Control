"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  FiCopy,
  FiDatabase,
  FiFolder,
  FiGithub,
  FiGlobe,
  FiKey,
  FiLock,
  FiPlus,
  FiSave,
  FiSend,
  FiServer,
  FiShield,
  FiSliders,
  FiTrash2,
  FiX,
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

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-400",
  POST: "text-amber-400",
  PUT: "text-sky-400",
  PATCH: "text-violet-400",
  DELETE: "text-rose-400",
  HEAD: "text-slate-400",
  OPTIONS: "text-slate-400",
};

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "request"
  );
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
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

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

  async function publishToGithub() {
    setPublishing(true);
    setPublishMessage(null);
    try {
      const slug = slugify(requestName);
      const collectionPath = `automation-lab/collections/${slug}.json`;
      const collection = {
        title: requestName,
        method,
        path,
        body,
        auth,
        headers: sanitizeKeyValueRows(headerRows),
        queryParams: sanitizeKeyValueRows(queryRows),
        variables: sanitizeKeyValueRows(localVariableRows),
        environment: currentEnvironment.id,
        exportedAt: new Date().toISOString(),
      };

      const response = await fetch("/api/automations/github/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          branch: `automation-lab/${slug}-${Date.now()}`,
          files: [{ path: collectionPath, content: JSON.stringify(collection, null, 2) }],
          commitMessage: `[postman] publish ${requestName}`,
          prTitle: `[Postman] Publicar coleção: ${requestName}`,
          prBody: `Coleção exportada do Postman interno (${collectionPath}).`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Falha ao publicar no GitHub.");
      setPublishMessage(`Publicado: ${payload.pullRequestUrl}`);
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Falha ao publicar no GitHub.");
    } finally {
      setPublishing(false);
    }
  }

  const tabClass = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-semibold transition ${
      active ? "border-[#FF6C37] text-white" : "border-transparent text-[#9195a3] hover:text-[#d6d8de]"
    }`;

  return (
    <section className="flex h-full min-h-[calc(100vh-160px)] flex-col overflow-hidden rounded-[16px] border border-[#2b2d3a] bg-[#1b1c26] text-[#e4e6ef] shadow-sm">
      {/* Top bar — Postman-style brand strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2b2d3a] bg-[#20212e] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#9195a3]">
          <span className="inline-flex items-center gap-2 rounded-md bg-[#2a2c3b] px-2.5 py-1 text-[#FF6C37]">
            <FiSend className="h-3.5 w-3.5" />
            Postman
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FiGlobe className="h-3.5 w-3.5" />
            {currentEnvironment?.title}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FiShield className="h-3.5 w-3.5" />
            {authLabel(auth)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveCurrentRequest}
            className="inline-flex min-h-8 items-center justify-center gap-2 rounded-md border border-[#3a3c4d] bg-[#2a2c3b] px-3 text-xs font-semibold text-[#e4e6ef] hover:bg-[#33354a]"
          >
            <FiSave className="h-3.5 w-3.5" />
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setShowPublishDialog(true)}
            className="inline-flex min-h-8 items-center justify-center gap-2 rounded-md border border-[#3a3c4d] bg-[#2a2c3b] px-3 text-xs font-semibold text-[#e4e6ef] hover:bg-[#33354a]"
          >
            <FiGithub className="h-3.5 w-3.5" />
            Enviar para GitHub
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        {/* Sidebar — collections */}
        <aside className="flex w-full flex-col border-b border-[#2b2d3a] bg-[#20212e] xl:w-64 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-2 px-3 py-3">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9195a3]">
              <FiFolder className="h-3.5 w-3.5" />
              Coleções
            </p>
            <span className="inline-flex rounded-full bg-[#2a2c3b] px-2 py-0.5 text-[10px] font-semibold text-[#9195a3]">
              {visiblePresets.length}
            </span>
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto px-2 pb-3 xl:max-h-none xl:flex-1">
            {visiblePresets.map((preset) => {
              const active = selectedPresetId === preset.id;
              const isSaved = "source" in preset && preset.source === "saved";
              return (
                <div key={preset.id} className={`rounded-md ${active ? "bg-[#2a2c3b]" : "hover:bg-[#252634]"}`}>
                  <button type="button" onClick={() => applyPreset(preset)} className="flex w-full items-center gap-2 px-2 py-2 text-left">
                    <span className={`w-11 shrink-0 text-[10px] font-black uppercase ${METHOD_COLORS[preset.method] ?? "text-[#9195a3]"}`}>
                      {preset.method}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#e4e6ef]">{preset.title}</span>
                    {isSaved ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeSavedRequest(preset.id);
                        }}
                        aria-label="Remover request salvo"
                        title="Remover request salvo"
                        className="shrink-0 text-[#6b6e7f] hover:text-rose-400"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col xl:flex-row xl:divide-x xl:divide-[#2b2d3a]">
          {/* Request editor */}
          <article className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 xl:basis-3/5">
            <input
              value={requestName}
              onChange={(event) => setRequestName(event.target.value)}
              className="mb-3 w-full rounded-md border border-transparent bg-transparent text-lg font-bold text-[#e4e6ef] outline-none focus:border-[#3a3c4d]"
              placeholder="Nome do request"
            />

            {/* Method + URL bar */}
            <div className="flex flex-wrap items-stretch gap-2">
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as AutomationHttpMethod)}
                className={`min-h-10 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 text-sm font-black outline-none ${METHOD_COLORS[method] ?? "text-[#e4e6ef]"}`}
              >
                {AUTOMATION_IDE_METHODS.map((item) => (
                  <option key={item} value={item} className="bg-[#20212e] text-white">
                    {item}
                  </option>
                ))}
              </select>
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/api/health"
                className="min-h-10 min-w-0 flex-1 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none focus:border-[#FF6C37]"
              />
              <button
                type="button"
                onClick={executeRequest}
                disabled={loading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#FF6C37] px-5 text-sm font-bold text-white transition hover:bg-[#e85f2c] disabled:opacity-60"
              >
                <FiSend className="h-4 w-4" />
                {loading ? "Enviando…" : "Send"}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-md bg-[#141520] px-3 py-2">
              <select
                value={selectedEnvironmentId}
                onChange={(event) => setSelectedEnvironmentId(event.target.value)}
                className="rounded border border-transparent bg-transparent text-[11px] font-semibold text-[#9195a3] outline-none"
              >
                {AUTOMATION_ENVIRONMENTS.map((environment) => (
                  <option key={environment.id} value={environment.id} className="bg-[#20212e] text-white">
                    {environment.title}
                  </option>
                ))}
              </select>
              <span className="truncate font-mono text-[11px] text-[#6b6e7f]">{resolvedUrlPreview}</span>
            </div>

            {missingVariableKeys.length > 0 ? (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                Variáveis pendentes: {missingVariableKeys.join(", ")}
              </div>
            ) : null}

            {/* Tabs */}
            <div className="mt-4 flex gap-1 border-b border-[#2b2d3a]">
              {[
                { id: "params" as const, label: "Params", icon: FiSliders },
                { id: "auth" as const, label: "Auth", icon: FiLock },
                { id: "variables" as const, label: "Variáveis", icon: FiDatabase },
                { id: "headers" as const, label: "Headers", icon: FiKey },
                { id: "body" as const, label: "Body", icon: FiServer },
              ].map((tab) => {
                const active = activePanel === tab.id;
                const Icon = tab.icon;
                return (
                  <button key={tab.id} type="button" onClick={() => setActivePanel(tab.id)} className={tabClass(active)}>
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activePanel === "params" ? (
              <section className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[#9195a3]">Query params — monte a query string sem editar a URL inteira.</p>
                  <button
                    type="button"
                    onClick={() => appendKeyValueRow(setQueryRows)}
                    aria-label="Adicionar query param"
                    title="Adicionar query param"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#e4e6ef]"
                  >
                    <FiPlus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 space-y-1.5">
                  {queryRows.map((row) => (
                    <div key={row.id} className="grid gap-1.5 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_32px]">
                      <input
                        value={row.key}
                        onChange={(event) => updateKeyValueRow(setQueryRows, row.id, "key", event.target.value)}
                        placeholder="param"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateKeyValueRow(setQueryRows, row.id, "value", event.target.value)}
                        placeholder="valor ou {{variavel}}"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyValueRow(setQueryRows, row.id)}
                        aria-label="Remover query param"
                        title="Remover query param"
                        className="inline-flex h-9 w-8 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#6b6e7f] hover:text-rose-400"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activePanel === "auth" ? (
              <section className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold text-[#9195a3]">
                    Tipo de autenticação
                    <select
                      value={auth.type}
                      onChange={(event) =>
                        setAuth((current) => ({
                          ...current,
                          type: event.target.value as AutomationRequestAuth["type"],
                          addTo: event.target.value === "api-key" ? current.addTo ?? "header" : current.addTo,
                        }))
                      }
                      className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 text-sm text-[#e4e6ef] outline-none"
                    >
                      <option value="none">None</option>
                      <option value="bearer">Bearer</option>
                      <option value="basic">Basic</option>
                      <option value="api-key">API Key</option>
                      <option value="session">Sessão atual</option>
                    </select>
                  </label>

                  <div className="rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 py-2 text-xs leading-6 text-[#9195a3]">
                    {auth.type === "session"
                      ? "Reaproveita os cookies da sessão atual para chamadas internas do próprio painel."
                      : auth.type === "api-key"
                        ? "A chave pode entrar em header ou query string."
                        : auth.type === "basic"
                          ? "Monta automaticamente o header Authorization Basic."
                          : auth.type === "bearer"
                            ? "Monta automaticamente o header Authorization Bearer."
                            : "A request segue sem autenticação adicional."}
                  </div>
                </div>

                {auth.type === "bearer" ? (
                  <label className="grid gap-1.5 text-xs font-semibold text-[#9195a3]">
                    Token Bearer
                    <input
                      value={auth.value ?? ""}
                      onChange={(event) => setAuth((current) => ({ ...current, value: event.target.value }))}
                      placeholder="token ou {{token}}"
                      className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                    />
                  </label>
                ) : null}

                {auth.type === "basic" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-semibold text-[#9195a3]">
                      Usuário
                      <input
                        value={auth.username ?? ""}
                        onChange={(event) => setAuth((current) => ({ ...current, username: event.target.value }))}
                        placeholder="user ou {{user}}"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 text-sm text-[#e4e6ef] outline-none"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#9195a3]">
                      Senha
                      <input
                        value={auth.password ?? ""}
                        onChange={(event) => setAuth((current) => ({ ...current, password: event.target.value }))}
                        placeholder="senha ou {{password}}"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 text-sm text-[#e4e6ef] outline-none"
                      />
                    </label>
                  </div>
                ) : null}

                {auth.type === "api-key" ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-1.5 text-xs font-semibold text-[#9195a3]">
                      Nome
                      <input
                        value={auth.key ?? ""}
                        onChange={(event) => setAuth((current) => ({ ...current, key: event.target.value }))}
                        placeholder="x-api-key"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 text-sm text-[#e4e6ef] outline-none"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#9195a3]">
                      Valor
                      <input
                        value={auth.value ?? ""}
                        onChange={(event) => setAuth((current) => ({ ...current, value: event.target.value }))}
                        placeholder="valor ou {{apiKey}}"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 text-sm text-[#e4e6ef] outline-none"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#9195a3]">
                      Inserir em
                      <select
                        value={auth.addTo ?? "header"}
                        onChange={(event) => setAuth((current) => ({ ...current, addTo: event.target.value as "header" | "query" }))}
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 text-sm text-[#e4e6ef] outline-none"
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
              <section className="mt-3 grid gap-4 xl:grid-cols-2">
                <article>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#9195a3]">Variáveis do ambiente — persistidas por empresa + ambiente.</p>
                    <button
                      type="button"
                      onClick={() => appendKeyValueRow(setEnvironmentVariableRows)}
                      aria-label="Adicionar variável de ambiente"
                      title="Adicionar variável de ambiente"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#e4e6ef]"
                    >
                      <FiPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {environmentVariableRows.map((row) => (
                      <div key={row.id} className="grid gap-1.5 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_32px]">
                        <input
                          value={row.key}
                          onChange={(event) => updateKeyValueRow(setEnvironmentVariableRows, row.id, "key", event.target.value)}
                          placeholder="apiKey"
                          className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                        />
                        <input
                          value={row.value}
                          onChange={(event) => updateKeyValueRow(setEnvironmentVariableRows, row.id, "value", event.target.value)}
                          placeholder="valor"
                          className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeKeyValueRow(setEnvironmentVariableRows, row.id)}
                          aria-label="Remover variável de ambiente"
                          title="Remover variável de ambiente"
                          className="inline-flex h-9 w-8 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#6b6e7f] hover:text-rose-400"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </article>

                <article>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#9195a3]">Variáveis do request — sobrescrevem o ambiente só nessa request.</p>
                    <button
                      type="button"
                      onClick={() => appendKeyValueRow(setLocalVariableRows)}
                      aria-label="Adicionar variável da request"
                      title="Adicionar variável da request"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#e4e6ef]"
                    >
                      <FiPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {localVariableRows.map((row) => (
                      <div key={row.id} className="grid gap-1.5 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_32px]">
                        <input
                          value={row.key}
                          onChange={(event) => updateKeyValueRow(setLocalVariableRows, row.id, "key", event.target.value)}
                          placeholder="cpf"
                          className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                        />
                        <input
                          value={row.value}
                          onChange={(event) => updateKeyValueRow(setLocalVariableRows, row.id, "value", event.target.value)}
                          placeholder="12345678900"
                          className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeKeyValueRow(setLocalVariableRows, row.id)}
                          aria-label="Remover variável da request"
                          title="Remover variável da request"
                          className="inline-flex h-9 w-8 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#6b6e7f] hover:text-rose-400"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="xl:col-span-2">
                  <p className="text-xs text-[#9195a3]">Variáveis de sistema</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {systemVariables.map((item) => (
                      <span
                        key={item.key}
                        className="inline-flex items-center gap-2 rounded-md border border-[#3a3c4d] bg-[#20212e] px-2.5 py-1 font-mono text-xs text-[#e4e6ef]"
                      >
                        {`{{${item.key}}}`} = {item.value || "--"}
                      </span>
                    ))}
                  </div>
                </article>
              </section>
            ) : null}

            {activePanel === "headers" ? (
              <section className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[#9195a3]">{"Headers — pode usar placeholders como `{{token}}`."}</p>
                  <button
                    type="button"
                    onClick={() => appendKeyValueRow(setHeaderRows)}
                    aria-label="Adicionar header"
                    title="Adicionar header"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#e4e6ef]"
                  >
                    <FiPlus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 space-y-1.5">
                  {headerRows.map((row) => (
                    <div key={row.id} className="grid gap-1.5 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_32px]">
                      <input
                        value={row.key}
                        onChange={(event) => updateKeyValueRow(setHeaderRows, row.id, "key", event.target.value)}
                        placeholder="Header"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateKeyValueRow(setHeaderRows, row.id, "value", event.target.value)}
                        placeholder="Valor"
                        className="min-h-9 rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 font-mono text-sm text-[#e4e6ef] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyValueRow(setHeaderRows, row.id)}
                        aria-label="Remover header"
                        title="Remover header"
                        className="inline-flex h-9 w-8 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#6b6e7f] hover:text-rose-400"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activePanel === "body" ? (
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={14}
                placeholder='{"cpf":"{{cpf}}"}'
                className="mt-3 rounded-md border border-[#3a3c4d] bg-[#141520] px-4 py-3 font-mono text-sm leading-7 text-[#e4e6ef] outline-none focus:border-[#FF6C37]"
              />
            ) : null}
          </article>

          {/* Response panel */}
          <aside className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#17181f] p-4 xl:basis-2/5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9195a3]">Response</p>
              <button
                type="button"
                onClick={copyResponse}
                disabled={!response}
                aria-label="Copiar resposta"
                title="Copiar resposta"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#3a3c4d] bg-[#20212e] text-[#e4e6ef] disabled:opacity-40"
              >
                <FiCopy className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
              <div className="rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6e7f]">Status</p>
                <p className={`mt-1 text-sm font-bold ${response && response.status < 400 ? "text-emerald-400" : response ? "text-rose-400" : "text-[#e4e6ef]"}`}>
                  {response ? `${response.status} ${response.statusText}` : "--"}
                </p>
              </div>
              <div className="rounded-md border border-[#3a3c4d] bg-[#20212e] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6e7f]">Duração</p>
                <p className="mt-1 text-sm font-bold text-[#e4e6ef]">{response ? `${response.durationMs} ms` : "--"}</p>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">{errorMessage}</div>
            ) : null}
            {copyFeedback ? (
              <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">{copyFeedback}</div>
            ) : null}

            <div className="mt-3 flex gap-1 border-b border-[#2b2d3a]">
              {[
                { id: "json", label: "JSON" },
                { id: "raw", label: "Raw" },
                { id: "headers", label: "Headers" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setResponseTab(tab.id as typeof responseTab)}
                  className={tabClass(responseTab === tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-80 flex-1 overflow-auto rounded-md bg-[#141520] p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-[#d6d8de]">
                {responseTab === "headers"
                  ? JSON.stringify(response?.headers ?? {}, null, 2)
                  : responseTab === "raw"
                    ? response?.text || ""
                    : JSON.stringify(response?.json ?? null, null, 2)}
              </pre>
            </div>
          </aside>
        </div>
      </div>

      {showPublishDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#3a3c4d] bg-[#20212e] p-5 text-[#e4e6ef] shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-bold">
                <FiGithub className="h-4 w-4" />
                Publicar no GitHub
              </p>
              <button type="button" onClick={() => setShowPublishDialog(false)} aria-label="Fechar" className="text-[#9195a3] hover:text-white">
                <FiX className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#9195a3]">
              Publicar <span className="font-semibold text-[#e4e6ef]">{requestName}</span> em{" "}
              <span className="font-mono text-xs text-[#e4e6ef]">AnaLysyk/Quality_Control</span>. Isso cria/atualiza uma branch e abre um Pull
              Request.
            </p>
            {publishMessage ? (
              <div className="mt-3 rounded-md border border-[#3a3c4d] bg-[#141520] px-3 py-2 text-xs text-[#d6d8de] break-all">{publishMessage}</div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPublishDialog(false)}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-[#3a3c4d] bg-transparent px-4 text-sm font-semibold text-[#e4e6ef]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={publishToGithub}
                disabled={publishing}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#FF6C37] px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                <FiGithub className="h-4 w-4" />
                {publishing ? "Publicando…" : "Confirmar publicação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

