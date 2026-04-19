"use client";

import { useEffect, useMemo, useState, type ComponentType, type Dispatch, type SetStateAction } from "react";
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiCode,
  FiCopy,
  FiDatabase,
  FiDownload,
  FiGlobe,
  FiKey,
  FiList,
  FiLock,
  FiPlay,
  FiPlus,
  FiSave,
  FiServer,
  FiShield,
  FiSliders,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

import { AUTOMATION_ENVIRONMENTS } from "@/data/automationCatalog";
import {
  AUTOMATION_API_PRESETS,
  AUTOMATION_IDE_METHODS,
  type AutomationAssertionRule,
  type AutomationAssertionType,
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

type AssertionResult = {
  ruleId: string;
  passed: boolean;
  label: string;
  actual: string;
};

type EditorPanel = "params" | "auth" | "variables" | "headers" | "body" | "tests" | "import-export" | "graphql" | "mock";

type SidebarView = "collection" | "runner" | "history";

type RunnerStepResult = {
  requestId: string;
  requestTitle: string;
  method: AutomationHttpMethod;
  status: number | null;
  statusText: string;
  durationMs: number | null;
  assertionResults: AssertionResult[];
  error: string | null;
};

type HistoryEntry = {
  id: string;
  timestamp: number;
  requestId: string;
  requestTitle: string;
  method: AutomationHttpMethod;
  status: number | null;
  durationMs: number | null;
  assertionPassed: number;
  assertionTotal: number;
  error: string | null;
};

const REQUEST_STORAGE_PREFIX = "qc:automation:api-lab:v2";
const ENV_STORAGE_PREFIX = "qc:automation:api-lab:env:v1";
const HISTORY_STORAGE_PREFIX = "qc:automation:api-lab:history:v1";
const BASE_URL_STORAGE_PREFIX = "qc:automation:api-lab:base-url:v1";
const DEFAULT_AUTH: AutomationRequestAuth = { type: "none" };

function historyStorageKey(companySlug: string | null) {
  return `${HISTORY_STORAGE_PREFIX}:${companySlug ?? "global"}`;
}

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

function baseUrlStorageKey(companySlug: string | null, environmentId: string) {
  return `${BASE_URL_STORAGE_PREFIX}:${companySlug ?? "global"}:${environmentId}`;
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

function createAssertionRule(): AutomationAssertionRule {
  return { id: Math.random().toString(36).slice(2, 10), type: "status-equals", path: "", expected: "200" };
}

function resolveJsonPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function runAssertions(rules: AutomationAssertionRule[], res: HttpResponseState): AssertionResult[] {
  return rules.map((rule) => {
    try {
      if (rule.type === "status-equals") {
        const actual = String(res.status);
        return { ruleId: rule.id, passed: actual === rule.expected.trim(), label: `Status = ${rule.expected}`, actual };
      }
      if (rule.type === "status-lt") {
        const actual = res.status;
        return { ruleId: rule.id, passed: actual < Number(rule.expected), label: `Status < ${rule.expected}`, actual: String(actual) };
      }
      if (rule.type === "json-path-equals") {
        const value = resolveJsonPath(res.json, rule.path);
        const actual = String(value ?? "");
        const passed = actual === rule.expected.trim() || JSON.stringify(value) === rule.expected.trim();
        return { ruleId: rule.id, passed, label: `${rule.path || "body"} = ${rule.expected}`, actual };
      }
      if (rule.type === "json-path-contains") {
        const value = resolveJsonPath(res.json, rule.path);
        const actual = String(value ?? "");
        return { ruleId: rule.id, passed: actual.includes(rule.expected), label: `${rule.path || "body"} contém "${rule.expected}"`, actual };
      }
      if (rule.type === "header-exists") {
        const lkey = rule.path.toLowerCase();
        const found = Object.keys(res.headers).some((k) => k.toLowerCase() === lkey);
        return { ruleId: rule.id, passed: found, label: `Header "${rule.path}" existe`, actual: found ? "exists" : "missing" };
      }
      if (rule.type === "header-equals") {
        const lkey = rule.path.toLowerCase();
        const actual = Object.entries(res.headers).find(([k]) => k.toLowerCase() === lkey)?.[1] ?? "";
        return { ruleId: rule.id, passed: actual === rule.expected, label: `Header "${rule.path}" = ${rule.expected}`, actual };
      }
      if (rule.type === "response-time-lt") {
        const actual = res.durationMs;
        return { ruleId: rule.id, passed: actual < Number(rule.expected), label: `Tempo < ${rule.expected}ms`, actual: `${actual}ms` };
      }
      return { ruleId: rule.id, passed: false, label: "tipo desconhecido", actual: "" };
    } catch {
      return { ruleId: rule.id, passed: false, label: rule.type, actual: "erro" };
    }
  });
}

function parseCurl(cmd: string): { method: AutomationHttpMethod; url: string; headers: AutomationRequestKeyValue[]; body: string } | null {
  try {
    const urlMatch = cmd.match(/curl\s+(?:-[^\s]+\s+\S+\s+)*(?:'([^']+)'|"([^"]+)"|(\S+))/);
    const url = urlMatch?.[1] ?? urlMatch?.[2] ?? urlMatch?.[3] ?? "";
    if (!url) return null;
    const methodMatch = cmd.match(/-X\s+([A-Z]+)/);
    const method = (methodMatch?.[1] ?? "GET") as AutomationHttpMethod;
    const headerMatches = [...cmd.matchAll(/-H\s+(?:'([^']+)'|"([^"]+)")/g)];
    const headers: AutomationRequestKeyValue[] = headerMatches.map((m) => {
      const raw = m[1] ?? m[2] ?? "";
      const idx = raw.indexOf(":");
      return { key: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
    });
    const bodyMatch = cmd.match(/(?:-d|--data(?:-raw)?)\s+(?:'([\s\S]*?)'(?=\s*(?:-[A-Z]|$))|"([\s\S]*?)"(?=\s*(?:-[A-Z]|$)))/);
    const body = bodyMatch?.[1] ?? bodyMatch?.[2] ?? "";
    return { method, url, headers, body };
  } catch {
    return null;
  }
}

function generateCurlSnippet(url: string, method: string, headers: Record<string, string>, body: string | null): string {
  const parts = [`curl -X ${method} '${url}'`];
  for (const [key, value] of Object.entries(headers)) parts.push(`  -H '${key}: ${value}'`);
  if (body) parts.push(`  -d '${body}'`);
  return parts.join(" \\\n");
}

function generateFetchSnippet(url: string, method: string, headers: Record<string, string>, body: string | null): string {
  const lines: string[] = [`const response = await fetch('${url}', {`, `  method: '${method}',`];
  if (Object.keys(headers).length > 0) {
    lines.push(`  headers: {`);
    for (const [k, v] of Object.entries(headers)) lines.push(`    '${k}': '${v}',`);
    lines.push(`  },`);
  }
  if (body) lines.push(`  body: JSON.stringify(${body}),`);
  lines.push(`});`, `const data = await response.json();`);
  return lines.join("\n");
}

function generateAxiosSnippet(url: string, method: string, headers: Record<string, string>, body: string | null): string {
  const lines: string[] = [`const { data } = await axios({`, `  method: '${method.toLowerCase()}',`, `  url: '${url}',`];
  if (Object.keys(headers).length > 0) {
    lines.push(`  headers: {`);
    for (const [k, v] of Object.entries(headers)) lines.push(`    '${k}': '${v}',`);
    lines.push(`  },`);
  }
  if (body) lines.push(`  data: ${body},`);
  lines.push(`});`);
  return lines.join("\n");
}

const ASSERTION_TYPE_LABELS: Record<AutomationAssertionType, string> = {
  "status-equals": "Status =",
  "status-lt": "Status <",
  "json-path-equals": "JSON path =",
  "json-path-contains": "JSON path contém",
  "header-exists": "Header existe",
  "header-equals": "Header =",
  "response-time-lt": "Tempo (ms) <",
};

const ASSERTION_TYPE_NEEDS_PATH: Record<AutomationAssertionType, boolean> = {
  "status-equals": false,
  "status-lt": false,
  "json-path-equals": true,
  "json-path-contains": true,
  "header-exists": true,
  "header-equals": true,
  "response-time-lt": false,
};

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
  const [assertionRules, setAssertionRules] = useState<AutomationAssertionRule[]>([]);
  const [assertionResults, setAssertionResults] = useState<AssertionResult[]>([]);
  const [curlImportText, setCurlImportText] = useState("");
  const [curlImportError, setCurlImportError] = useState<string | null>(null);
  const [exportLang, setExportLang] = useState<"curl" | "fetch" | "axios">("curl");
  // GraphQL
  const [graphqlQuery, setGraphqlQuery] = useState("query {\n  \n}");
  const [graphqlVariables, setGraphqlVariables] = useState("{}");
  // Mock
  const [mockEnabled, setMockEnabled] = useState(false);
  const [mockStatus, setMockStatus] = useState("200");
  const [mockBody, setMockBody] = useState("{\"ok\":true}");
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>("collection");
  const [runnerResults, setRunnerResults] = useState<RunnerStepResult[]>([]);
  const [runnerRunning, setRunnerRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<HttpResponseState | null>(null);
  const [responseTab, setResponseTab] = useState<"json" | "raw" | "headers" | "tests">("json");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<EditorPanel>("params");
  const [baseUrlInput, setBaseUrlInput] = useState("");

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(historyStorageKey(activeCompanySlug));
      if (!raw) { setHistory([]); return; }
      const parsed = JSON.parse(raw) as HistoryEntry[];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, [activeCompanySlug]);

  const currentEnvironment = useMemo(
    () => AUTOMATION_ENVIRONMENTS.find((environment) => environment.id === selectedEnvironmentId) ?? AUTOMATION_ENVIRONMENTS[0],
    [selectedEnvironmentId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(baseUrlStorageKey(activeCompanySlug, selectedEnvironmentId));
      setBaseUrlInput(raw && raw.trim().length > 0 ? raw : currentEnvironment.baseUrl);
    } catch {
      setBaseUrlInput(currentEnvironment.baseUrl);
    }
  }, [activeCompanySlug, currentEnvironment.baseUrl, selectedEnvironmentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const normalized = baseUrlInput.trim();
    const key = baseUrlStorageKey(activeCompanySlug, selectedEnvironmentId);
    if (!normalized || normalized === currentEnvironment.baseUrl) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, normalized);
  }, [activeCompanySlug, baseUrlInput, currentEnvironment.baseUrl, selectedEnvironmentId]);

  const effectiveBaseUrl = baseUrlInput.trim() || currentEnvironment.baseUrl;

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
        currentEnvironmentBaseUrl: effectiveBaseUrl,
        currentEnvironmentId: currentEnvironment.id,
        currentEnvironmentTitle: currentEnvironment.title,
      }),
    [activeCompanySlug, currentEnvironment.id, currentEnvironment.title, effectiveBaseUrl, selectedCompany?.name],
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
        effectiveBaseUrl,
        path,
        sanitizeKeyValueRows(queryRows),
        auth,
        resolvedVariables,
      ),
    [auth, effectiveBaseUrl, path, queryRows, resolvedVariables],
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
    setAssertionRules(preset.assertions ?? []);
    setAssertionResults([]);
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
      assertions: assertionRules,
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

      let res: HttpResponseState;

      if (mockEnabled) {
        let mockJson: unknown = null;
        try { mockJson = JSON.parse(mockBody); } catch { /* not json */ }
        res = {
          status: parseInt(mockStatus, 10) || 200,
          statusText: "Mock",
          durationMs: 0,
          headers: { "content-type": "application/json" },
          json: mockJson,
          text: mockBody,
          url: resolvedUrlPreview,
        };
      } else {
        const execution = await fetch("/api/automations/http", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        res = payload.response as HttpResponseState;
      }

      setResponse(res);
      const resolvedAssertions = assertionRules.length > 0 ? runAssertions(assertionRules, res) : [];
      if (resolvedAssertions.length > 0) {
        setAssertionResults(resolvedAssertions);
        setResponseTab("tests");
      }

      const histEntry: HistoryEntry = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        requestId: selectedPresetId,
        requestTitle: requestName,
        method,
        status: res.status,
        durationMs: res.durationMs,
        assertionPassed: resolvedAssertions.filter((r) => r.passed).length,
        assertionTotal: resolvedAssertions.length,
        error: null,
      };
      setHistory((prev) => {
        const next = [histEntry, ...prev].slice(0, 50);
        if (typeof window !== "undefined") window.localStorage.setItem(historyStorageKey(activeCompanySlug), JSON.stringify(next));
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao executar request.");
    } finally {
      setLoading(false);
    }
  }

  async function executeGraphql() {
    setLoading(true);
    setErrorMessage(null);
    setResponse(null);

    try {
      const endpoint = resolveTemplate(path, resolvedVariables);
      const resolvedEndpoint = buildResolvedUrl(effectiveBaseUrl, endpoint, [], auth, resolvedVariables);
      const gqlHeaders: Record<string, string> = { "Content-Type": "application/json" };
      for (const row of sanitizeKeyValueRows(headerRows)) {
        const key = resolveTemplate(row.key, resolvedVariables).trim();
        if (key) gqlHeaders[key] = resolveTemplate(row.value, resolvedVariables);
      }
      if (auth.type === "bearer") gqlHeaders.Authorization = `Bearer ${resolveTemplate(auth.value ?? "", resolvedVariables)}`;
      if (auth.type === "basic") gqlHeaders.Authorization = encodeBasicAuth(resolveTemplate(auth.username ?? "", resolvedVariables), resolveTemplate(auth.password ?? "", resolvedVariables));

      let parsedVars: Record<string, unknown> = {};
      try { parsedVars = JSON.parse(graphqlVariables || "{}"); } catch { /* ignore */ }

      const gqlBody = JSON.stringify({ query: graphqlQuery, variables: parsedVars });

      const execution = await fetch("/api/automations/http", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: gqlBody, forwardCookies: auth.type === "session", headers: gqlHeaders, method: "POST", timeoutMs: 15000, url: resolvedEndpoint }),
      });
      const payload = await execution.json();
      if (!execution.ok || !payload?.response) throw new Error(payload?.error ?? "Falha ao executar GraphQL.");
      setResponse(payload.response as HttpResponseState);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao executar GraphQL.");
    } finally {
      setLoading(false);
    }
  }

  async function runCollection() {
    if (savedRequests.length === 0 || runnerRunning) return;
    setRunnerRunning(true);
    setSidebarView("runner");
    setRunnerResults([]);
    const results: RunnerStepResult[] = [];

    for (const req of savedRequests) {
      const stepResult: RunnerStepResult = {
        requestId: req.id,
        requestTitle: req.title,
        method: req.method,
        status: null,
        statusText: "",
        durationMs: null,
        assertionResults: [],
        error: null,
      };

      try {
        const registry: Record<string, string> = {};
        for (const sv of systemVariables) registry[sv.key] = sv.value;
        for (const row of sanitizeKeyValueRows(environmentVariableRows)) registry[row.key] = row.value;
        for (const v of req.variables ?? []) registry[v.key] = v.value;

        const reqAuth = req.auth ?? DEFAULT_AUTH;
        const resolvedUrl = buildResolvedUrl(effectiveBaseUrl, req.path, req.queryParams ?? [], reqAuth, registry);
        const headers: Record<string, string> = {};
        for (const h of req.headers ?? []) {
          const key = resolveTemplate(h.key, registry).trim();
          if (key) headers[key] = resolveTemplate(h.value, registry);
        }
        if (reqAuth.type === "bearer") headers.Authorization = `Bearer ${resolveTemplate(reqAuth.value ?? "", registry)}`;
        if (reqAuth.type === "basic") headers.Authorization = encodeBasicAuth(resolveTemplate(reqAuth.username ?? "", registry), resolveTemplate(reqAuth.password ?? "", registry));
        if (reqAuth.type === "api-key" && reqAuth.addTo !== "query") {
          const k = resolveTemplate(reqAuth.key ?? "", registry).trim();
          if (k) headers[k] = resolveTemplate(reqAuth.value ?? "", registry);
        }
        const resolvedBody = req.body?.trim() ? resolveTemplate(req.body, registry) : null;
        const execution = await fetch("/api/automations/http", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: resolvedBody, forwardCookies: reqAuth.type === "session", headers, method: req.method, timeoutMs: 15000, url: resolvedUrl }),
        });
        const payload = await execution.json();
        if (!execution.ok || !payload?.response) throw new Error(payload?.error ?? "Falha na execução");
        const res = payload.response as HttpResponseState;
        stepResult.status = res.status;
        stepResult.statusText = res.statusText;
        stepResult.durationMs = res.durationMs;
        stepResult.assertionResults = runAssertions(req.assertions ?? [], res);
      } catch (err) {
        stepResult.error = err instanceof Error ? err.message : "Erro desconhecido";
      }

      results.push(stepResult);
      setRunnerResults([...results]);

      const histEntry: HistoryEntry = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        requestId: stepResult.requestId,
        requestTitle: stepResult.requestTitle,
        method: stepResult.method,
        status: stepResult.status,
        durationMs: stepResult.durationMs,
        assertionPassed: stepResult.assertionResults.filter((r) => r.passed).length,
        assertionTotal: stepResult.assertionResults.length,
        error: stepResult.error,
      };
      setHistory((prev) => {
        const next = [histEntry, ...prev].slice(0, 50);
        if (typeof window !== "undefined") window.localStorage.setItem(historyStorageKey(activeCompanySlug), JSON.stringify(next));
        return next;
      });
    }
    setRunnerRunning(false);
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

  function importFromCurl() {
    const result = parseCurl(curlImportText.trim());
    if (!result) {
      setCurlImportError("Não foi possível interpretar o comando cURL. Verifique a sintaxe.");
      return;
    }
    setCurlImportError(null);
    setMethod(result.method);
    setPath(result.url);
    setHeaderRows(buildKeyValueRows(result.headers.length > 0 ? result.headers : []));
    if (result.body) setBody(result.body);
    setCurlImportText("");
    setCopyFeedback("Request importado do cURL");
    window.setTimeout(() => setCopyFeedback(null), 1600);
  }

  function buildCurrentHeaders(): Record<string, string> {
    const headers = sanitizeKeyValueRows(headerRows).reduce<Record<string, string>>((acc, row) => {
      const key = resolveTemplate(row.key, resolvedVariables).trim();
      if (key) acc[key] = resolveTemplate(row.value, resolvedVariables);
      return acc;
    }, {});
    if (auth.type === "bearer") headers.Authorization = `Bearer ${resolveTemplate(auth.value ?? "", resolvedVariables)}`;
    if (auth.type === "basic") headers.Authorization = encodeBasicAuth(resolveTemplate(auth.username ?? "", resolvedVariables), resolveTemplate(auth.password ?? "", resolvedVariables));
    if (auth.type === "api-key" && auth.addTo !== "query") {
      const key = resolveTemplate(auth.key ?? "", resolvedVariables).trim();
      if (key) headers[key] = resolveTemplate(auth.value ?? "", resolvedVariables);
    }
    return headers;
  }

  function getExportSnippet() {
    const headers = buildCurrentHeaders();
    const resolvedBody = body.trim() ? resolveTemplate(body, resolvedVariables) : null;
    if (exportLang === "curl") return generateCurlSnippet(resolvedUrlPreview, method, headers, resolvedBody);
    if (exportLang === "axios") return generateAxiosSnippet(resolvedUrlPreview, method, headers, resolvedBody);
    return generateFetchSnippet(resolvedUrlPreview, method, headers, resolvedBody);
  }

  async function copyExportSnippet() {
    await navigator.clipboard.writeText(getExportSnippet());
    setCopyFeedback("Código copiado");
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
          {mockEnabled ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <FiToggleRight className="h-4 w-4" />
              Mock {mockStatus}
            </span>
          ) : null}
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

      <div className="grid items-start gap-4 2xl:grid-cols-12">
        <aside className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 2xl:col-span-3 2xl:sticky 2xl:top-6">
          {/* Sidebar tab bar */}
          <div className="flex gap-1 rounded-xl border border-(--tc-border,#d7deea) bg-white p-1">
            {([
              { id: "collection" as const, icon: FiList, label: "Coleção" },
              { id: "runner" as const, icon: FiActivity, label: "Runner" },
              { id: "history" as const, icon: FiClock, label: "Histórico" },
            ] satisfies { id: SidebarView; icon: ComponentType<{ className?: string }>; label: string }[]).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-label="Adicionar parâmetro"
                  onClick={() => setSidebarView(tab.id)}
                  className={`flex-1 min-h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${sidebarView === tab.id ? "bg-(--tc-surface-2,#f8fafc) text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text,#0b1a3c)"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Collection view */}
          {sidebarView === "collection" ? (
            <>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Coleção</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                    {visiblePresets.length}
                  </span>
                  {savedRequests.length > 0 ? (
                    <button
                      type="button"
                      aria-label="Remover parâmetro"
                      onClick={runCollection}
                      disabled={runnerRunning}
                      title="Executar todos os requests salvos em sequência"
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-(--tc-primary,#011848) px-3 text-[11px] font-semibold text-white disabled:opacity-60"
                    >
                      <FiPlay className="h-3 w-3" />
                      Run All
                    </button>
                  ) : null}
                </div>
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
            </>
          ) : null}

          {/* Runner view */}
          {sidebarView === "runner" ? (
            <>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                  {runnerRunning ? "Executando…" : `Runner — ${runnerResults.length} requests`}
                </p>
                {!runnerRunning && savedRequests.length > 0 ? (
                  <button
                    type="button"
                    onClick={runCollection}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-(--tc-primary,#011848) px-3 text-[11px] font-semibold text-white"
                  >
                    <FiPlay className="h-3 w-3" />
                    Run
                  </button>
                ) : null}
              </div>
              {runnerResults.length === 0 && !runnerRunning ? (
                <p className="mt-4 text-center text-sm text-(--tc-text-muted,#6b7280)">Clique em Run All na aba Coleção para executar.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {runnerResults.map((result) => {
                    const allPassed = result.assertionResults.length > 0 && result.assertionResults.every((r) => r.passed);
                    const anyFailed = result.assertionResults.some((r) => !r.passed);
                    const isOk = !result.error && result.status !== null && result.status < 400;
                    const statusColor = result.error ? "border-rose-300 bg-rose-50" : anyFailed ? "border-amber-300 bg-amber-50" : allPassed || isOk ? "border-emerald-300 bg-emerald-50" : "border-(--tc-border,#d7deea) bg-white";
                    return (
                      <div key={result.requestId} className={`rounded-xl border px-3 py-3 ${statusColor}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{result.requestTitle}</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                              {result.method}
                            </p>
                          </div>
                          {result.error ? (
                            <FiXCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                          ) : allPassed ? (
                            <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <FiActivity className="mt-0.5 h-4 w-4 shrink-0 text-(--tc-text-muted,#6b7280)" />
                          )}
                        </div>
                        {result.error ? (
                          <p className="mt-1 text-xs text-rose-600">{result.error}</p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-(--tc-text-muted,#6b7280)">
                            <span>{result.status} {result.statusText}</span>
                            {result.durationMs !== null ? <span>{result.durationMs}ms</span> : null}
                            {result.assertionResults.length > 0 ? (
                              <span className={anyFailed ? "text-rose-600" : "text-emerald-600"}>
                                {result.assertionResults.filter((r) => r.passed).length}/{result.assertionResults.length} assertions
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {runnerRunning ? (
                    <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white/70 px-3 py-3 text-sm text-(--tc-text-muted,#6b7280) animate-pulse">
                      Executando próximo request…
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}

          {/* History view */}
          {sidebarView === "history" ? (
            <>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Histórico</p>
                {history.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHistory([]);
                      if (typeof window !== "undefined") window.localStorage.removeItem(historyStorageKey(activeCompanySlug));
                    }}
                    className="text-[10px] font-semibold text-(--tc-text-muted,#6b7280) hover:text-rose-600"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
              {history.length === 0 ? (
                <p className="mt-4 text-center text-sm text-(--tc-text-muted,#6b7280)">Nenhuma execução registrada ainda.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {history.map((entry) => {
                    const isOk = !entry.error && entry.status !== null && entry.status < 400;
                    const anyFailed = entry.assertionTotal > 0 && entry.assertionPassed < entry.assertionTotal;
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-xl border px-3 py-2 ${entry.error ? "border-rose-200 bg-rose-50" : anyFailed ? "border-amber-200 bg-amber-50" : isOk ? "border-emerald-200 bg-emerald-50" : "border-(--tc-border,#d7deea) bg-white"}`}
                      >
                        <p className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{entry.requestTitle}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold text-(--tc-text-muted,#6b7280)">
                          <span>{entry.method}</span>
                          {entry.status !== null ? <span>{entry.status}</span> : null}
                          {entry.durationMs !== null ? <span>{entry.durationMs}ms</span> : null}
                          {entry.assertionTotal > 0 ? (
                            <span className={anyFailed ? "text-rose-600" : "text-emerald-600"}>
                              {entry.assertionPassed}/{entry.assertionTotal} OK
                            </span>
                          ) : null}
                          {entry.error ? <span className="text-rose-600 truncate">{entry.error}</span> : null}
                        </div>
                        <p className="mt-1 text-[10px] text-(--tc-text-muted,#6b7280)">
                          {new Date(entry.timestamp).toLocaleTimeString("pt-BR")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </aside>

        <article className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 2xl:col-span-9">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_120px_180px_auto]">
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
            <label className="grid gap-2 md:col-span-2 2xl:col-span-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Base URL
              <input
                value={baseUrlInput}
                onChange={(event) => setBaseUrlInput(event.target.value)}
                placeholder={currentEnvironment.baseUrl}
                className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
              />
            </label>
          </div>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Path / URL
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
            />
          </label>

          <div className="mt-3 rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">URL resolvida</p>
            <p className="mt-1 break-all font-mono text-xs leading-6 text-white">{resolvedUrlPreview}</p>
          </div>

          {missingVariableKeys.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-700">
                  Variáveis pendentes: {missingVariableKeys.join(", ")}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-2">
            {[
              { id: "params" as const, label: "Params", icon: FiSliders },
              { id: "auth" as const, label: "Auth", icon: FiLock },
              { id: "variables" as const, label: "Variáveis", icon: FiDatabase },
              { id: "headers" as const, label: "Headers", icon: FiKey },
              { id: "body" as const, label: "Body", icon: FiServer },
              { id: "tests" as const, label: assertionRules.length > 0 ? `Tests (${assertionRules.length})` : "Tests", icon: FiCheckCircle },
              { id: "import-export" as const, label: "cURL / Export", icon: FiCode },
              { id: "graphql" as const, label: "GraphQL", icon: FiZap },
              { id: "mock" as const, label: mockEnabled ? "Mock ✓" : "Mock", icon: mockEnabled ? FiToggleRight : FiToggleLeft },
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
            <section className="mt-4 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Query params</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Monte a query string sem editar a URL inteira.</p>
                </div>
                <button
                  type="button"
                  aria-label="Adicionar parâmetro"
                  onClick={() => appendKeyValueRow(setQueryRows)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {queryRows.map((row) => (
                  <div key={row.id} className="grid gap-2 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
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
                      aria-label="Remover parâmetro"
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
            <section className="mt-4 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
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
                    className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer</option>
                    <option value="basic">Basic</option>
                    <option value="api-key">API Key</option>
                    <option value="session">Sessão atual</option>
                  </select>
                </label>

                <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
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
                    Usuário
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
              <article className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Variáveis do ambiente</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Persistidas por empresa + ambiente selecionado.</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Adicionar variável de ambiente"
                    onClick={() => appendKeyValueRow(setEnvironmentVariableRows)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                  >
                    <FiPlus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {environmentVariableRows.map((row) => (
                    <div key={row.id} className="grid gap-2 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
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
                        aria-label="Remover variável de ambiente"
                        onClick={() => removeKeyValueRow(setEnvironmentVariableRows, row.id)}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Variáveis do request</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Sobrescrevem o ambiente só nessa request.</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Adicionar variável do request"
                    onClick={() => appendKeyValueRow(setLocalVariableRows)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                  >
                    <FiPlus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {localVariableRows.map((row) => (
                    <div key={row.id} className="grid gap-2 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
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
                        aria-label="Remover variável do request"
                        onClick={() => removeKeyValueRow(setLocalVariableRows, row.id)}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3 xl:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Variáveis de sistema</p>
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
            <section className="mt-4 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Headers</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{"Pode usar placeholders como `{{token}}`."}</p>
                </div>
                <button
                  type="button"
                  aria-label="Adicionar header"
                  onClick={() => appendKeyValueRow(setHeaderRows)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {headerRows.map((row) => (
                  <div key={row.id} className="grid gap-2 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_36px]">
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
                      aria-label="Remover header"
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
                className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-white outline-none"
              />
            </label>
          ) : null}

          {activePanel === "tests" ? (
            <section className="mt-4 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Assertions</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Executadas automaticamente após cada request.</p>
                </div>
                <button
                  type="button"
                  aria-label="Adicionar assertion"
                  onClick={() => setAssertionRules((prev) => [...prev, createAssertionRule()])}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              {assertionRules.length === 0 ? (
                <p className="mt-4 text-center text-sm text-(--tc-text-muted,#6b7280)">Nenhuma assertion. Clique em + para adicionar.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {assertionRules.map((rule) => (
                    <div key={rule.id} className="grid gap-2 xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)_36px]">
                      <select
                        aria-label="Tipo de assertion"
                        value={rule.type}
                        onChange={(e) =>
                          setAssertionRules((prev) =>
                            prev.map((r) => (r.id === rule.id ? { ...r, type: e.target.value as AutomationAssertionType, path: "", expected: r.type === "status-equals" ? "200" : r.expected } : r)),
                          )
                        }
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                      >
                        {(Object.keys(ASSERTION_TYPE_LABELS) as AutomationAssertionType[]).map((t) => (
                          <option key={t} value={t}>{ASSERTION_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                      {ASSERTION_TYPE_NEEDS_PATH[rule.type] ? (
                        <input
                          value={rule.path}
                          onChange={(e) => setAssertionRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, path: e.target.value } : r)))}
                          placeholder={rule.type.startsWith("json") ? "data.user.id" : "content-type"}
                          className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                        />
                      ) : (
                        <div className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 flex items-center text-xs text-(--tc-text-muted,#6b7280)">
                          —
                        </div>
                      )}
                      <input
                        value={rule.expected}
                        onChange={(e) => setAssertionRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, expected: e.target.value } : r)))}
                        placeholder={rule.type === "status-equals" ? "200" : rule.type === "response-time-lt" ? "1000" : "valor esperado"}
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-white px-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Remover assertion"
                        onClick={() => setAssertionRules((prev) => prev.filter((r) => r.id !== rule.id))}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activePanel === "import-export" ? (
            <section className="mt-4 space-y-4">
              <article className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Importar cURL</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Cole um comando cURL e preencha o request automaticamente.</p>
                  </div>
                </div>
                <textarea
                  value={curlImportText}
                  onChange={(e) => { setCurlImportText(e.target.value); setCurlImportError(null); }}
                  rows={5}
                  placeholder={`curl -X POST 'https://api.exemplo.com/endpoint' \\\n  -H 'Authorization: Bearer token' \\\n  -d '{"key":"value"}'`}
                  className="mt-3 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-xs leading-6 text-white outline-none"
                />
                {curlImportError ? (
                  <p className="mt-2 text-sm font-semibold text-rose-600">{curlImportError}</p>
                ) : null}
                <button
                  type="button"
                  onClick={importFromCurl}
                  disabled={!curlImportText.trim()}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) disabled:opacity-50"
                >
                  <FiDownload className="h-4 w-4" />
                  Importar
                </button>
              </article>

              <article className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Exportar código</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Gera snippet do request atual com variáveis resolvidas.</p>
                  </div>
                  <div className="flex gap-1 rounded-xl border border-(--tc-border,#d7deea) bg-white p-1">
                    {(["curl", "fetch", "axios"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setExportLang(lang)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${exportLang === lang ? "bg-(--tc-surface-2,#f8fafc) text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280)"}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
                <pre className="mt-3 overflow-auto rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-xs leading-6 text-white">
                  {getExportSnippet()}
                </pre>
                <button
                  type="button"
                  onClick={copyExportSnippet}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  <FiCopy className="h-4 w-4" />
                  Copiar código
                </button>
              </article>
            </section>
          ) : null}

          {activePanel === "graphql" ? (
            <section className="mt-4 space-y-3">
              <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">GraphQL</p>
                <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                  Endpoint configurado no campo Path acima. Auth e Headers são compartilhados.
                </p>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Query / Mutation
                <textarea
                  value={graphqlQuery}
                  onChange={(e) => setGraphqlQuery(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder={"query {\n  user(id: \"1\") {\n    name\n    email\n  }\n}"}
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-white outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Variables (JSON)
                <textarea
                  value={graphqlVariables}
                  onChange={(e) => setGraphqlVariables(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder={'{"id": "1"}'}
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-white outline-none"
                />
              </label>
              <button
                type="button"
                onClick={executeGraphql}
                disabled={loading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <FiZap className="h-4 w-4" />
                {loading ? "Executando…" : "Executar GraphQL"}
              </button>
            </section>
          ) : null}

          {activePanel === "mock" ? (
            <section className="mt-4 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Mock de resposta</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                    Quando ativo, o Executar usa essa resposta sem fazer chamada real.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMockEnabled((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${mockEnabled ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"}`}
                >
                  {mockEnabled ? <FiToggleRight className="h-4 w-4" /> : <FiToggleLeft className="h-4 w-4" />}
                  {mockEnabled ? "Ativo" : "Inativo"}
                </button>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Status HTTP
                <input
                  value={mockStatus}
                  onChange={(e) => setMockStatus(e.target.value)}
                  placeholder="200"
                  className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Body da resposta (JSON)
                <textarea
                  value={mockBody}
                  onChange={(e) => setMockBody(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder={'{"ok": true, "data": {}}'}
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-white outline-none"
                />
              </label>
              {mockEnabled ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
                  Mock ativo — próxima execução usará essa resposta simulada.
                </div>
              ) : null}
            </section>
          ) : null}
        </article>

        <aside className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 2xl:col-span-12">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Response</p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Copiar resposta"
                onClick={copyResponse}
                disabled={!response}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c) disabled:opacity-40"
              >
                <FiCopy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
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
              <p className="mt-1 truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{response?.url ?? resolvedUrlPreview}</p>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700">{errorMessage}</div>
          ) : null}
          {copyFeedback ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">{copyFeedback}</div>
          ) : null}

          <div className="mt-4 inline-flex max-w-full overflow-x-auto rounded-xl border border-(--tc-border,#d7deea) bg-white p-1">
            {[
              { id: "json", label: "JSON" },
              { id: "raw", label: "Raw" },
              { id: "headers", label: "Headers" },
              {
                id: "tests",
                label: assertionResults.length > 0
                  ? `Tests ${assertionResults.filter((r) => r.passed).length}/${assertionResults.length}`
                  : "Tests",
              },
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

          <div className="mt-3 min-h-105 rounded-2xl border border-(--tc-border,#d7deea) bg-[#081227] p-4">
            {responseTab === "tests" ? (
              assertionResults.length === 0 ? (
                <p className="text-sm text-white/60">
                  {assertionRules.length === 0
                    ? "Adicione assertions na aba Tests e execute o request."
                    : "Execute o request para ver os resultados."}
                </p>
              ) : (
                <div className="space-y-2">
                  {assertionResults.map((result) => (
                    <div
                      key={result.ruleId}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${result.passed ? "border-emerald-700 bg-emerald-950/60" : "border-rose-700 bg-rose-950/60"}`}
                    >
                      {result.passed ? (
                        <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <FiXCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${result.passed ? "text-emerald-300" : "text-rose-300"}`}>{result.label}</p>
                        <p className="mt-0.5 text-xs text-white/50">obtido: {result.actual || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white">
                {responseTab === "headers"
                  ? JSON.stringify(response?.headers ?? {}, null, 2)
                  : responseTab === "raw"
                    ? response?.text || ""
                    : JSON.stringify(response?.json ?? null, null, 2)}
              </pre>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-(--tc-text-muted,#6b7280)">
            <FiClock className="h-4 w-4" />
            BFF interno para request com auth, params e variáveis sem abrir Postman.
          </div>
        </aside>
      </div>
    </section>
  );
}
