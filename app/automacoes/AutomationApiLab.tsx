"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType, type Dispatch, type SetStateAction } from "react";
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiDatabase,
  FiDownload,
  FiList,
  FiPlay,
  FiPlus,
  FiServer,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiUploadCloud,
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
import { isTestingCompanyScope, matchesAutomationCompanyScope, normalizeAutomationCompanyScope } from "@/lib/automations/companyScope";

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

type EditorPanel = "params" | "auth" | "variables" | "headers" | "body" | "scripts" | "tests" | "import-export" | "graphql" | "mock";

type SidebarView = "collection" | "runner" | "history";

type PostmanCollectionExport = {
  info?: {
    name?: string;
  };
  item?: PostmanItem[];
};

type PostmanItem = {
  item?: PostmanItem[];
  name?: string;
  request?: PostmanRequest;
  variable?: AutomationRequestKeyValue[];
};

type PostmanRequest = {
  auth?: {
    type?: string;
    apikey?: Array<{
      key?: string;
      value?: string;
    }>;
    bearer?: Array<{
      key?: string;
      value?: string;
    }>;
    basic?: Array<{
      key?: string;
      value?: string;
    }>;
  };
  body?: {
    formdata?: Array<{
      key?: string;
      type?: string;
      value?: string;
    }>;
    mode?: string;
    raw?: string;
    urlencoded?: Array<{
      key?: string;
      value?: string;
    }>;
  };
  header?: Array<AutomationRequestKeyValue & { disabled?: boolean }>;
  method?: string;
  url?:
    | string
    | {
        host?: string[];
        path?: string[];
        query?: Array<AutomationRequestKeyValue & { disabled?: boolean }>;
        raw?: string;
        variable?: AutomationRequestKeyValue[];
      };
};

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

type ScriptRequestDraft = {
  auth: AutomationRequestAuth;
  body: string;
  headers: AutomationRequestKeyValue[];
  method: AutomationHttpMethod;
  path: string;
  queryParams: AutomationRequestKeyValue[];
};

type PreRequestScriptResult = {
  draft: ScriptRequestDraft;
  environmentVariables: AutomationRequestKeyValue[];
  localVariables: AutomationRequestKeyValue[];
  logs: string[];
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

function mergeKeyValueRows(rows: KeyValueRow[], updates: AutomationRequestKeyValue[]) {
  const next = [...rows];
  for (const update of updates) {
    const key = update.key.trim();
    if (!key) continue;
    const index = next.findIndex((row) => row.key.trim() === key);
    if (index >= 0) {
      next[index] = { ...next[index], key, value: update.value };
    } else {
      next.push(createKeyValueRow({ key, value: update.value }));
    }
  }
  return next;
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

// ── Variable source types & badge config ─────────────────────────────────────
type VarSource = "env" | "local" | "system";

function buildVarSourceMap(
  envRows: { key: string }[],
  localRows: { key: string }[],
  sysVars: { key: string }[],
): Record<string, VarSource> {
  const map: Record<string, VarSource> = {};
  for (const v of sysVars) if (v.key) map[v.key] = "system";
  for (const v of envRows) if (v.key) map[v.key] = "env";
  for (const v of localRows) if (v.key) map[v.key] = "local";
  return map;
}

const SOURCE_BADGE: Record<VarSource, { label: string; cls: string }> = {
  env:    { label: "E", cls: "bg-orange-500 text-white" },
  local:  { label: "L", cls: "bg-blue-500 text-white" },
  system: { label: "S", cls: "bg-violet-500 text-white" },
};

function VarDropdown({
  vars, resolvedVariables, varSourceMap, onInsert,
}: {
  vars: string[];
  resolvedVariables: Record<string, string>;
  varSourceMap: Record<string, VarSource>;
  onInsert: (key: string) => void;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-xl">
      <p className="border-b border-(--tc-border,#d7deea) px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-(--tc-text-muted,#6b7280)">
        Variáveis disponíveis
      </p>
      {vars.length === 0 ? (
        <p className="px-3 py-3 text-sm text-(--tc-text-muted,#6b7280)">Nenhuma variável definida</p>
      ) : (
        vars.slice(0, 8).map((key) => {
          const src = varSourceMap[key];
          const badge = src ? SOURCE_BADGE[src] : null;
          return (
            <button
              key={key}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onInsert(key); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-(--tc-surface-2,#f8fafc)"
            >
              {badge && (
                <span className={`shrink-0 inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
              <code className="shrink-0 rounded bg-orange-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-orange-600 dark:bg-orange-900/20 dark:text-orange-300">{`{{${key}}}`}</code>
              <span className="min-w-0 truncate font-mono text-xs text-(--tc-text-muted,#6b7280)">{resolvedVariables[key] || "—"}</span>
            </button>
          );
        })
      )}
      <div className="flex items-center justify-between border-t border-(--tc-border,#d7deea) px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10px] text-(--tc-text-muted,#6b7280)">
          {([ ["E","bg-orange-500","Ambiente"], ["L","bg-blue-500","Local"], ["S","bg-violet-500","Sistema"] ] as const).map(([lbl, cls, name]) => (
            <span key={lbl} className="flex items-center gap-1">
              <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded text-[8px] font-bold text-white ${cls}`}>{lbl}</span>
              <span>{name}</span>
            </span>
          ))}
        </div>
        <span className="text-[10px] text-(--tc-text-muted,#6b7280)">Variáveis no request →</span>
      </div>
    </div>
  );
}

// ── VarAutocomplete (wraps regular inputs) ────────────────────────────────────
type VarAutocompleteProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
  resolvedVariables: Record<string, string>;
  varSourceMap?: Record<string, VarSource>;
  wrapperClassName?: string;
};

function VarAutocomplete({ value, onChange, resolvedVariables, varSourceMap = {}, wrapperClassName = "relative flex-1 min-w-0", className, placeholder, ...rest }: VarAutocompleteProps) {
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const allVarKeys = Object.keys(resolvedVariables);
  const filtered = filter ? allVarKeys.filter((k) => k.toLowerCase().includes(filter.toLowerCase())) : allVarKeys;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/\{\{([^}]*)$/);
    setFilter(match ? match[1] : "");
    setShow(!!match);
    onChange(val);
  }

  function insertVar(varName: string) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursor);
    const match = textBefore.match(/\{\{([^}]*)$/);
    const newVal = match
      ? value.slice(0, cursor - match[0].length) + `{{${varName}}}` + value.slice(cursor)
      : value.slice(0, cursor) + `{{${varName}}}` + value.slice(cursor);
    onChange(newVal);
    setShow(false);
    setTimeout(() => el?.focus(), 0);
  }

  return (
    <div className={wrapperClassName}>
      <input ref={inputRef} value={value} onChange={handleChange} onBlur={() => setTimeout(() => setShow(false), 200)} placeholder={placeholder} className={className} {...rest} />
      {show && <VarDropdown vars={filtered} resolvedVariables={resolvedVariables} varSourceMap={varSourceMap} onInsert={insertVar} />}
    </div>
  );
}

// ── URL bar with inline variable highlighting (Postman-style) ─────────────────
type UrlVarInputProps = {
  value: string;
  onChange: (v: string) => void;
  resolvedVariables: Record<string, string>;
  varSourceMap?: Record<string, VarSource>;
  placeholder?: string;
  inputClassName?: string;
};

function UrlVarInput({ value, onChange, resolvedVariables, varSourceMap = {}, placeholder, inputClassName }: UrlVarInputProps) {
  const [showAc, setShowAc] = useState(false);
  const [acFilter, setAcFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  type Seg = { type: "text"; text: string } | { type: "var"; text: string; key: string; isDefined: boolean };
  const segments = useMemo<Seg[]>(() => {
    const parts: Seg[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = regex.exec(value)) !== null) {
      if (m.index > last) parts.push({ type: "text", text: value.slice(last, m.index) });
      const key = m[1].trim();
      parts.push({ type: "var", text: m[0], key, isDefined: Object.prototype.hasOwnProperty.call(resolvedVariables, key) });
      last = m.index + m[0].length;
    }
    if (last < value.length) parts.push({ type: "text", text: value.slice(last) });
    return parts;
  }, [value, resolvedVariables]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/\{\{([^}]*)$/);
    setAcFilter(match ? match[1] : "");
    setShowAc(!!match);
    onChange(val);
  }

  function insertVar(varName: string) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursor);
    const match = textBefore.match(/\{\{([^}]*)$/);
    const newVal = match
      ? value.slice(0, cursor - match[0].length) + `{{${varName}}}` + value.slice(cursor)
      : value.slice(0, cursor) + `{{${varName}}}` + value.slice(cursor);
    onChange(newVal);
    setShowAc(false);
    setTimeout(() => el?.focus(), 0);
  }

  const allVarKeys = Object.keys(resolvedVariables);
  const filteredVars = acFilter ? allVarKeys.filter((k) => k.toLowerCase().includes(acFilter.toLowerCase())) : allVarKeys;
  const varSegs = segments.filter((s): s is Extract<Seg, { type: "var" }> => s.type === "var");

  return (
    <div className="relative flex-1 min-w-0">
      {/* Highlight overlay — pointer-events-none, renders ALL text so dark mode works */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-4">
        <span className="whitespace-pre text-sm text-(--tc-text,#0b1a3c)">
          {segments.map((seg, idx) =>
            seg.type === "text" ? (
              <span key={idx}>{seg.text}</span>
            ) : (
              <span
                key={idx}
                className={`rounded px-0.5 text-xs font-semibold ${
                  seg.isDefined
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                    : "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
                }`}
              >{seg.text}</span>
            ),
          )}
        </span>
      </div>

      {/* Actual input — transparent text + caret, overlay renders the visual */}
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setShowAc(false), 200)}
        placeholder={placeholder}
        className={`text-transparent caret-(--tc-text,#0b1a3c) ${inputClassName ?? ""}`}
      />

      {/* Autocomplete dropdown */}
      {showAc && <VarDropdown vars={filteredVars} resolvedVariables={resolvedVariables} varSourceMap={varSourceMap} onInsert={insertVar} />}

      {/* Resolved variable chips below the bar */}
      {!showAc && varSegs.length > 0 && (
        <div className="absolute left-0 top-full z-40 mt-0.5 flex flex-wrap gap-1">
          {varSegs.map((seg) => {
            const src = varSourceMap[seg.key];
            const badge = src ? SOURCE_BADGE[src] : null;
            return (
              <span
                key={seg.key}
                title={`${seg.key} = ${resolvedVariables[seg.key] ?? "não definida"}`}
                className={`inline-flex cursor-default items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold shadow-sm ${
                  seg.isDefined
                    ? "border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                    : "border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                }`}
              >
                {badge && <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded text-[8px] font-bold text-white ${badge.cls}`}>{badge.label}</span>}
                {seg.text}
                {seg.isDefined && <span className="font-normal opacity-60">= {resolvedVariables[seg.key] || "vazio"}</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function colorizeJson(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < json.length) {
    // String token
    if (json[i] === '"') {
      const start = i;
      i++;
      while (i < json.length) {
        if (json[i] === "\\") { i += 2; continue; }
        if (json[i] === '"') { i++; break; }
        i++;
      }
      const raw = json.slice(start, i);
      // Peek ahead to check if this is a key (followed by colon after optional whitespace)
      let j = i;
      while (j < json.length && /[ \t]/.test(json[j])) j++;
      const isKey = json[j] === ":";
      nodes.push(
        <span key={k++} className={isKey ? "text-slate-800 font-semibold dark:text-zinc-200" : "text-emerald-600 dark:text-emerald-400"}>
          {raw}
        </span>,
      );
    }
    // Number
    else if (/[-0-9]/.test(json[i]) && (i === 0 || /[,\[:\s]/.test(json[i - 1]))) {
      const start = i;
      if (json[i] === "-") i++;
      while (i < json.length && /[0-9.eE+\-]/.test(json[i])) i++;
      nodes.push(<span key={k++} className="text-orange-500 dark:text-orange-400">{json.slice(start, i)}</span>);
    }
    // true / false / null
    else if (json.slice(i, i + 4) === "true") {
      nodes.push(<span key={k++} className="text-blue-500 dark:text-blue-400">true</span>);
      i += 4;
    } else if (json.slice(i, i + 5) === "false") {
      nodes.push(<span key={k++} className="text-blue-500 dark:text-blue-400">false</span>);
      i += 5;
    } else if (json.slice(i, i + 4) === "null") {
      nodes.push(<span key={k++} className="text-slate-400 italic dark:text-slate-500">null</span>);
      i += 4;
    }
    // Braces / brackets
    else if ("{}[]".includes(json[i])) {
      nodes.push(<span key={k++} className="text-slate-500 dark:text-slate-400">{json[i]}</span>);
      i++;
    }
    // Colon / comma
    else if (json[i] === ":" || json[i] === ",") {
      nodes.push(<span key={k++} className="text-slate-400 dark:text-slate-500">{json[i]}</span>);
      i++;
    }
    // Whitespace — keep as plain text for correct indentation
    else {
      const start = i;
      while (i < json.length && /\s/.test(json[i])) i++;
      nodes.push(json.slice(start, i));
    }
  }

  return nodes;
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

function collectMissingVariableKeys(input: {
  auth: AutomationRequestAuth;
  body: string;
  environmentVariableRows: AutomationRequestKeyValue[];
  headerRows: AutomationRequestKeyValue[];
  localVariableRows: AutomationRequestKeyValue[];
  path: string;
  queryRows: AutomationRequestKeyValue[];
  resolvedVariables: Record<string, string>;
}) {
  const referenced = new Set<string>();

  collectTemplateKeys(input.path).forEach((key) => referenced.add(key));
  collectTemplateKeys(input.body).forEach((key) => referenced.add(key));

  for (const row of [...input.headerRows, ...input.queryRows, ...input.localVariableRows, ...input.environmentVariableRows]) {
    collectTemplateKeys(row.key).forEach((key) => referenced.add(key));
    collectTemplateKeys(row.value).forEach((key) => referenced.add(key));
  }

  if (input.auth.type === "bearer" || input.auth.type === "api-key") {
    collectTemplateKeys(input.auth.value ?? "").forEach((key) => referenced.add(key));
  }

  if (input.auth.type === "api-key") {
    collectTemplateKeys(input.auth.key ?? "").forEach((key) => referenced.add(key));
  }

  if (input.auth.type === "basic") {
    collectTemplateKeys(input.auth.username ?? "").forEach((key) => referenced.add(key));
    collectTemplateKeys(input.auth.password ?? "").forEach((key) => referenced.add(key));
  }

  return Array.from(referenced).filter((key) => !Object.prototype.hasOwnProperty.call(input.resolvedVariables, key));
}

function cloneScriptDraft(draft: ScriptRequestDraft): ScriptRequestDraft {
  return {
    auth: { ...draft.auth },
    body: draft.body,
    headers: draft.headers.map((entry) => ({ ...entry })),
    method: draft.method,
    path: draft.path,
    queryParams: draft.queryParams.map((entry) => ({ ...entry })),
  };
}

function upsertAutomationRequestRow(rows: AutomationRequestKeyValue[], key: string, value: string) {
  const normalizedKey = key.trim();
  if (!normalizedKey) return rows;
  const index = rows.findIndex((entry) => entry.key.trim() === normalizedKey);
  if (index >= 0) {
    const next = [...rows];
    next[index] = { key: normalizedKey, value };
    return next;
  }
  return [...rows, { key: normalizedKey, value }];
}

function removeAutomationRequestRow(rows: AutomationRequestKeyValue[], key: string) {
  const normalizedKey = key.trim().toLowerCase();
  return rows.filter((entry) => entry.key.trim().toLowerCase() !== normalizedKey);
}

function normalizeScriptValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createScriptConsole(logs: string[]) {
  const push = (level: string, args: unknown[]) => {
    const payload = args.map(normalizeScriptValue).join(" ");
    logs.push(`[${level}] ${payload}`.trim());
  };
  return {
    debug: (...args: unknown[]) => push("debug", args),
    error: (...args: unknown[]) => push("error", args),
    info: (...args: unknown[]) => push("info", args),
    log: (...args: unknown[]) => push("log", args),
    warn: (...args: unknown[]) => push("warn", args),
  };
}

async function runPreRequestScript(
  script: string,
  input: {
    companySlug: string | null;
    draft: ScriptRequestDraft;
    environmentVariables: AutomationRequestKeyValue[];
    localVariables: AutomationRequestKeyValue[];
    lookup: Record<string, string>;
  },
): Promise<PreRequestScriptResult> {
  const source = script.trim();
  const draft = cloneScriptDraft(input.draft);
  const environmentMap = Object.fromEntries(input.environmentVariables.map((entry) => [entry.key, entry.value]));
  const localMap = Object.fromEntries(input.localVariables.map((entry) => [entry.key, entry.value]));
  const logs: string[] = [];
  if (!source) {
    return { draft, environmentVariables: input.environmentVariables, localVariables: input.localVariables, logs };
  }

  const readVariable = (key: string) => {
    const normalized = key.trim();
    if (!normalized) return "";
    if (Object.prototype.hasOwnProperty.call(localMap, normalized)) return localMap[normalized] ?? "";
    if (Object.prototype.hasOwnProperty.call(environmentMap, normalized)) return environmentMap[normalized] ?? "";
    return input.lookup[normalized] ?? "";
  };

  const setEnvironmentVariable = (key: string, value: unknown) => {
    const normalized = key.trim();
    if (!normalized) return;
    environmentMap[normalized] = normalizeScriptValue(value);
  };

  const setLocalVariable = (key: string, value: unknown) => {
    const normalized = key.trim();
    if (!normalized) return;
    localMap[normalized] = normalizeScriptValue(value);
  };

  const requestApi = {
    auth: {
      get: () => draft.auth,
      set: (next: Partial<AutomationRequestAuth>) => {
        draft.auth = { ...draft.auth, ...next };
      },
    },
    body: {
      get: () => draft.body,
      set: (value: unknown) => {
        draft.body = normalizeScriptValue(value);
      },
    },
    headers: {
      get: (key: string) => draft.headers.find((entry) => entry.key.toLowerCase() === key.trim().toLowerCase())?.value ?? "",
      remove: (key: string) => {
        draft.headers = removeAutomationRequestRow(draft.headers, key);
      },
      upsert: (entry: AutomationRequestKeyValue) => {
        if (!entry?.key) return;
        draft.headers = upsertAutomationRequestRow(draft.headers, entry.key, normalizeScriptValue(entry.value));
      },
    },
    method: {
      get: () => draft.method,
      set: (value: unknown) => {
        const normalized = String(value ?? "").toUpperCase();
        if (AUTOMATION_IDE_METHODS.includes(normalized as AutomationHttpMethod)) {
          draft.method = normalized as AutomationHttpMethod;
        }
      },
    },
    query: {
      get: (key: string) => draft.queryParams.find((entry) => entry.key.toLowerCase() === key.trim().toLowerCase())?.value ?? "",
      remove: (key: string) => {
        draft.queryParams = removeAutomationRequestRow(draft.queryParams, key);
      },
      upsert: (entry: AutomationRequestKeyValue) => {
        if (!entry?.key) return;
        draft.queryParams = upsertAutomationRequestRow(draft.queryParams, entry.key, normalizeScriptValue(entry.value));
      },
    },
    url: {
      get: () => draft.path,
      set: (value: unknown) => {
        draft.path = normalizeScriptValue(value);
      },
    },
  };

  const pm = {
    collectionVariables: {
      get: readVariable,
      has: (key: string) => readVariable(key).length > 0,
      set: setLocalVariable,
      unset: (key: string) => {
        delete localMap[key.trim()];
      },
    },
    environment: {
      get: (key: string) => environmentMap[key.trim()] ?? "",
      has: (key: string) => Object.prototype.hasOwnProperty.call(environmentMap, key.trim()),
      set: setEnvironmentVariable,
      unset: (key: string) => {
        delete environmentMap[key.trim()];
      },
    },
    execution: {
      setVariable: setLocalVariable,
    },
    info: {
      companySlug: input.companySlug ?? "",
      name: "API Lab pre-request script",
      requestName: "",
    },
    request: requestApi,
    variables: {
      get: readVariable,
      has: (key: string) => readVariable(key).length > 0,
      set: setLocalVariable,
      unset: (key: string) => {
        delete localMap[key.trim()];
      },
    },
  };

  const consoleProxy = createScriptConsole(logs);
  const executor = new Function(
    "pm",
    "context",
    "console",
    `"use strict"; return (async () => {\n${source}\n})();`,
  ) as (pm: unknown, context: { companySlug: string | null }, console: ReturnType<typeof createScriptConsole>) => Promise<unknown>;

  await executor(pm, { companySlug: input.companySlug }, consoleProxy);

  return {
    draft,
    environmentVariables: Object.entries(environmentMap).map(([key, value]) => ({ key, value })),
    localVariables: Object.entries(localMap).map(([key, value]) => ({ key, value })),
    logs,
  };
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

function normalizePostmanAuth(auth?: PostmanRequest["auth"]): AutomationRequestAuth {
  if (!auth?.type || auth.type === "noauth") return { type: "none" };
  if (auth.type === "bearer") {
    return { type: "bearer", value: auth.bearer?.[0]?.value ?? "" };
  }
  if (auth.type === "basic") {
    const username = auth.basic?.find((entry) => entry.key === "username")?.value ?? "";
    const password = auth.basic?.find((entry) => entry.key === "password")?.value ?? "";
    return { type: "basic", username, password };
  }
  if (auth.type === "apikey") {
    const key = auth.apikey?.find((entry) => entry.key === "key")?.value ?? "";
    const value = auth.apikey?.find((entry) => entry.key === "value")?.value ?? "";
    const addTo = auth.apikey?.find((entry) => entry.key === "in")?.value === "query" ? "query" : "header";
    return { type: "api-key", key, value, addTo };
  }
  return { type: "none" };
}

function buildPostmanUrl(url: PostmanRequest["url"]) {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url.raw) return url.raw;
  const host = (url.host ?? []).filter(Boolean).join(".");
  const path = (url.path ?? []).filter(Boolean).join("/");
  if (!host) return path ? `/${path}` : "";
  if (host.includes("{{")) return `${host}${path ? `/${path}` : ""}`;
  const prefix = host.startsWith("http") ? host : `https://${host}`;
  return `${prefix}${path ? `/${path}` : ""}`;
}

function normalizePostmanBody(body?: PostmanRequest["body"]) {
  if (!body) return "";
  if (body.mode === "raw") return body.raw ?? "";
  if (body.mode === "urlencoded") {
    return JSON.stringify(
      (body.urlencoded ?? []).reduce<Record<string, string>>((accumulator, item) => {
        if (item.key) accumulator[item.key] = item.value ?? "";
        return accumulator;
      }, {}),
      null,
      2,
    );
  }
  if (body.mode === "formdata") {
    return JSON.stringify(
      (body.formdata ?? []).reduce<Array<Record<string, string>>>((accumulator, item) => {
        if (item.key) accumulator.push({ key: item.key, type: item.type ?? "", value: item.value ?? "" });
        return accumulator;
      }, []),
      null,
      2,
    );
  }
  return "";
}

function flattenPostmanItems(items: PostmanItem[], parents: string[] = []): PostmanItem[] {
  return items.flatMap((item) => {
    const nextParents = item.name ? [...parents, item.name] : parents;
    if (item.item && item.item.length > 0) {
      return flattenPostmanItems(item.item, nextParents);
    }
    return item.request ? [{ ...item, name: nextParents.join(" / ") || item.name || "Request" }] : [];
  });
}

function postmanItemsToSavedRequests(items: PostmanItem[], companyScope: AutomationRequestPreset["companyScope"]): SavedRequest[] {
  return flattenPostmanItems(items).map((item, index) => {
    const request = item.request ?? {};
    const rawUrl = buildPostmanUrl(request.url);
    const headers = (request.header ?? []).filter((entry) => !entry.disabled && entry.key).map((entry) => ({ key: entry.key ?? "", value: entry.value ?? "" }));
    const queryParams =
      typeof request.url === "object" && request.url?.query
        ? request.url.query.filter((entry) => !entry.disabled && entry.key).map((entry) => ({ key: entry.key ?? "", value: entry.value ?? "" }))
        : [];

    return {
      id: `postman-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.name ?? `Request ${index + 1}`,
      method: (request.method?.toUpperCase() ?? "GET") as AutomationHttpMethod,
      path: rawUrl,
      body: normalizePostmanBody(request.body),
      auth: normalizePostmanAuth(request.auth),
      headers,
      queryParams,
      variables:
        typeof request.url === "object"
          ? (request.url.variable ?? []).filter((entry) => entry.key).map((entry) => ({ key: entry.key ?? "", value: entry.value ?? "" }))
          : [],
      assertions: [],
      companyScope,
      tags: ["postman"],
      source: "saved",
    };
  });
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
  const [preRequestScript, setPreRequestScript] = useState("");
  const [scriptOutput, setScriptOutput] = useState<string[]>([]);
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
  const [postmanImportError, setPostmanImportError] = useState<string | null>(null);
  const [postmanImportFeedback, setPostmanImportFeedback] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  // Snapshot of last-saved / initial state for discard
  const lastSavedRef = useRef({
    requestName: AUTOMATION_API_PRESETS[0]?.title ?? "Request",
    method: (AUTOMATION_API_PRESETS[0]?.method ?? "GET") as AutomationHttpMethod,
    path: AUTOMATION_API_PRESETS[0]?.path ?? "/api/health",
    body: AUTOMATION_API_PRESETS[0]?.body ?? "",
    auth: buildAuthState(AUTOMATION_API_PRESETS[0]?.auth),
    headerRows: buildKeyValueRows(AUTOMATION_API_PRESETS[0]?.headers ?? []),
    queryRows: buildKeyValueRows(AUTOMATION_API_PRESETS[0]?.queryParams ?? []),
    localVariableRows: buildKeyValueRows(AUTOMATION_API_PRESETS[0]?.variables ?? []),
    assertionRules: [] as AutomationAssertionRule[],
    preRequestScript: AUTOMATION_API_PRESETS[0]?.preRequestScript ?? "",
  });
  const postmanFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.slug === activeCompanySlug) ?? companies[0] ?? null,
    [activeCompanySlug, companies],
  );
  const activeCompanyScope = normalizeAutomationCompanyScope(activeCompanySlug) ?? "all";

  useEffect(() => {
    if (!activeCompanySlug) { setSavedRequests([]); return; }
    let cancelled = false;
    fetch(`/api/automations/collections?companySlug=${encodeURIComponent(activeCompanySlug)}`)
      .then((r) => r.json())
      .then((data: { requests?: SavedRequest[] }) => {
        if (cancelled) return;
        if (Array.isArray(data.requests)) setSavedRequests(data.requests as SavedRequest[]);
        else {
          // Fallback: try localStorage
          try {
            const raw = window.localStorage.getItem(storageKey(activeCompanySlug));
            if (raw) setSavedRequests(JSON.parse(raw) as SavedRequest[]);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {
        try {
          const raw = window.localStorage.getItem(storageKey(activeCompanySlug));
          if (raw) setSavedRequests(JSON.parse(raw) as SavedRequest[]);
        } catch { /* ignore */ }
      });
    return () => { cancelled = true; };
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

  // Mark dirty whenever the user edits request fields
  const dirtyTrackerRef = useRef(false);
  useEffect(() => {
    if (!dirtyTrackerRef.current) { dirtyTrackerRef.current = true; return; } // skip initial render
    setIsDirty(true);
  }, [requestName, method, path, body, auth, headerRows, queryRows, localVariableRows, assertionRules, preRequestScript]);

  // Ctrl+S → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) saveCurrentRequest();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, requestName, method, path, body, auth, headerRows, queryRows, localVariableRows, assertionRules, preRequestScript]);

  // Navigation guard — warn before browser tab close / refresh when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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

  const varSourceMap = useMemo(
    () => buildVarSourceMap(sanitizeKeyValueRows(environmentVariableRows), sanitizeKeyValueRows(localVariableRows), systemVariables),
    [environmentVariableRows, localVariableRows, systemVariables],
  );

  const missingVariableKeys = useMemo(() => {
    return collectMissingVariableKeys({
      auth,
      body,
      environmentVariableRows: sanitizeKeyValueRows(environmentVariableRows),
      headerRows: sanitizeKeyValueRows(headerRows),
      localVariableRows: sanitizeKeyValueRows(localVariableRows),
      path,
      queryRows: sanitizeKeyValueRows(queryRows),
      resolvedVariables,
    });
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
    setPreRequestScript(preset.preRequestScript ?? "");
    setScriptOutput([]);
    setErrorMessage(null);
    setResponse(null);
    setIsDirty(false);
  }

  function persistSavedRequests(nextRequests: SavedRequest[]) {
    setSavedRequests(nextRequests);
    // Keep localStorage as offline cache
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(activeCompanySlug), JSON.stringify(nextRequests));
    }
  }

  async function runRequestPreScript(draft: ScriptRequestDraft, lookup: Record<string, string>) {
    const result = await runPreRequestScript(preRequestScript, {
      companySlug: activeCompanySlug,
      draft,
      environmentVariables: sanitizeKeyValueRows(environmentVariableRows),
      localVariables: sanitizeKeyValueRows(localVariableRows),
      lookup,
    });

    setScriptOutput(result.logs);
    if (result.environmentVariables.length > 0) {
      setEnvironmentVariableRows((current) => mergeKeyValueRows(current, result.environmentVariables));
    }
    if (result.localVariables.length > 0) {
      setLocalVariableRows((current) => mergeKeyValueRows(current, result.localVariables));
    }

    const nextLookup = {
      ...lookup,
      ...Object.fromEntries(result.environmentVariables.map((entry) => [entry.key, entry.value])),
      ...Object.fromEntries(result.localVariables.map((entry) => [entry.key, entry.value])),
    };

    return { draft: result.draft, lookup: nextLookup, logs: result.logs };
  }

  function syncRequestToDb(req: SavedRequest) {
    if (!activeCompanySlug) return;
    void fetch("/api/automations/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: req.id, companySlug: activeCompanySlug, name: req.title, payload: req }),
    });
  }

  function deleteRequestFromDb(requestId: string) {
    if (!activeCompanySlug) return;
    void fetch("/api/automations/collections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: requestId, companySlug: activeCompanySlug }),
    });
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
      preRequestScript,
      companyScope: "all",
      tags: ["saved"],
      source: "saved",
    };

    persistSavedRequests([snapshot, ...savedRequests]);
    syncRequestToDb(snapshot);
    setSelectedPresetId(snapshot.id);
    setIsDirty(false);
    // Update last-saved snapshot so discard works correctly after a save
    lastSavedRef.current = { requestName: snapshot.title, method, path, body, auth, headerRows, queryRows, localVariableRows, assertionRules, preRequestScript };
    setCopyFeedback("Request salvo com auth, params e variáveis");
    window.setTimeout(() => setCopyFeedback(null), 1400);
  }

  function discardChanges() {
    const s = lastSavedRef.current;
    setRequestName(s.requestName);
    setMethod(s.method);
    setPath(s.path);
    setBody(s.body);
    setAuth(s.auth);
    setHeaderRows(s.headerRows);
    setQueryRows(s.queryRows);
    setLocalVariableRows(s.localVariableRows);
    setAssertionRules(s.assertionRules);
    setPreRequestScript(s.preRequestScript);
    setIsDirty(false);
  }

  function removeSavedRequest(requestId: string) {
    persistSavedRequests(savedRequests.filter((request) => request.id !== requestId));
    deleteRequestFromDb(requestId);
    if (selectedPresetId === requestId) {
      applyPreset(AUTOMATION_API_PRESETS[0]);
    }
  }

  async function executeRequest() {
    setLoading(true);
    setErrorMessage(null);
    setResponse(null);

    try {
      const initialDraft: ScriptRequestDraft = {
        auth: buildAuthState(auth),
        body,
        headers: sanitizeKeyValueRows(headerRows),
        method,
        path,
        queryParams: sanitizeKeyValueRows(queryRows),
      };

      const scripted = await runRequestPreScript(initialDraft, resolvedVariables);
      const executionVariables = scripted.lookup;
      const runtimeMissing = collectMissingVariableKeys({
        auth: scripted.draft.auth,
        body: scripted.draft.body,
        environmentVariableRows: sanitizeKeyValueRows(environmentVariableRows),
        headerRows: scripted.draft.headers,
        localVariableRows: sanitizeKeyValueRows(localVariableRows),
        path: scripted.draft.path,
        queryRows: scripted.draft.queryParams,
        resolvedVariables: executionVariables,
      });
      if (runtimeMissing.length > 0) {
        throw new Error(`Defina as variáveis: ${runtimeMissing.join(", ")}.`);
      }

      const headers = scripted.draft.headers.reduce<Record<string, string>>((accumulator, row) => {
        const key = resolveTemplate(row.key, executionVariables).trim();
        if (!key) return accumulator;
        accumulator[key] = resolveTemplate(row.value, executionVariables);
        return accumulator;
      }, {});

      if (scripted.draft.auth.type === "bearer") {
        const token = resolveTemplate(scripted.draft.auth.value ?? "", executionVariables).trim();
        if (!token) throw new Error("Informe o token Bearer.");
        headers.Authorization = `Bearer ${token}`;
      }

      if (scripted.draft.auth.type === "basic") {
        const username = resolveTemplate(scripted.draft.auth.username ?? "", executionVariables);
        const password = resolveTemplate(scripted.draft.auth.password ?? "", executionVariables);
        if (!username && !password) {
          throw new Error("Informe usuário e senha para Basic Auth.");
        }
        headers.Authorization = encodeBasicAuth(username, password);
      }

      if (scripted.draft.auth.type === "api-key" && scripted.draft.auth.addTo !== "query") {
        const key = resolveTemplate(scripted.draft.auth.key ?? "", executionVariables).trim();
        if (!key) throw new Error("Informe o nome da API Key.");
        headers[key] = resolveTemplate(scripted.draft.auth.value ?? "", executionVariables);
      }

      const resolvedBody = scripted.draft.body.trim() ? resolveTemplate(scripted.draft.body, executionVariables) : null;
      const resolvedUrl = buildResolvedUrl(
        effectiveBaseUrl,
        scripted.draft.path,
        scripted.draft.queryParams,
        scripted.draft.auth,
        executionVariables,
      );

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
          url: resolvedUrl,
        };
      } else {
        const execution = await fetch("/api/automations/http", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: resolvedBody,
            companySlug: activeCompanySlug,
            forwardCookies: scripted.draft.auth.type === "session",
            headers,
            method: scripted.draft.method,
            timeoutMs: 15000,
            url: resolvedUrl,
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
        method: scripted.draft.method,
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
          body: JSON.stringify({
            body: gqlBody,
            companySlug: activeCompanySlug,
            forwardCookies: auth.type === "session",
            headers: gqlHeaders,
            method: "POST",
            timeoutMs: 15000,
            url: resolvedEndpoint,
          }),
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
    let runtimeEnvironmentRows = sanitizeKeyValueRows(environmentVariableRows);
    let runtimeLocalRows = sanitizeKeyValueRows(localVariableRows);
    let runtimeLookup = Object.fromEntries(systemVariables.map((sv) => [sv.key, sv.value]));
    for (const row of runtimeEnvironmentRows) runtimeLookup[row.key] = row.value;
    for (const row of runtimeLocalRows) runtimeLookup[row.key] = row.value;

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
        const requestLookup = { ...runtimeLookup };
        for (const v of req.variables ?? []) requestLookup[v.key] = v.value;

        const scripted = await runPreRequestScript(req.preRequestScript ?? "", {
          companySlug: activeCompanySlug,
          draft: {
            auth: buildAuthState(req.auth),
            body: req.body ?? "",
            headers: [...(req.headers ?? [])],
            method: req.method,
            path: req.path,
            queryParams: [...(req.queryParams ?? [])],
          },
          environmentVariables: runtimeEnvironmentRows,
          localVariables: runtimeLocalRows,
          lookup: requestLookup,
        });

        runtimeEnvironmentRows = scripted.environmentVariables;
        runtimeLocalRows = scripted.localVariables;
        runtimeLookup = {
          ...Object.fromEntries(systemVariables.map((sv) => [sv.key, sv.value])),
          ...Object.fromEntries(runtimeEnvironmentRows.map((row) => [row.key, row.value])),
          ...Object.fromEntries(runtimeLocalRows.map((row) => [row.key, row.value])),
          ...Object.fromEntries((req.variables ?? []).map((v) => [v.key, v.value])),
        };
        setScriptOutput(scripted.logs);

        const runtimeMissing = collectMissingVariableKeys({
          auth: scripted.draft.auth,
          body: scripted.draft.body,
          environmentVariableRows: runtimeEnvironmentRows,
          headerRows: scripted.draft.headers,
          localVariableRows: runtimeLocalRows,
          path: scripted.draft.path,
          queryRows: scripted.draft.queryParams,
          resolvedVariables: runtimeLookup,
        });
        if (runtimeMissing.length > 0) {
          throw new Error(`Defina as variáveis: ${runtimeMissing.join(", ")}.`);
        }

        const resolvedUrl = buildResolvedUrl(effectiveBaseUrl, scripted.draft.path, scripted.draft.queryParams, scripted.draft.auth, runtimeLookup);
        const headers: Record<string, string> = {};
        for (const h of scripted.draft.headers) {
          const key = resolveTemplate(h.key, runtimeLookup).trim();
          if (key) headers[key] = resolveTemplate(h.value, runtimeLookup);
        }
        if (scripted.draft.auth.type === "bearer") headers.Authorization = `Bearer ${resolveTemplate(scripted.draft.auth.value ?? "", runtimeLookup)}`;
        if (scripted.draft.auth.type === "basic") headers.Authorization = encodeBasicAuth(resolveTemplate(scripted.draft.auth.username ?? "", runtimeLookup), resolveTemplate(scripted.draft.auth.password ?? "", runtimeLookup));
        if (scripted.draft.auth.type === "api-key" && scripted.draft.auth.addTo !== "query") {
          const k = resolveTemplate(scripted.draft.auth.key ?? "", runtimeLookup).trim();
          if (k) headers[k] = resolveTemplate(scripted.draft.auth.value ?? "", runtimeLookup);
        }
        const resolvedBody = scripted.draft.body?.trim() ? resolveTemplate(scripted.draft.body, runtimeLookup) : null;
        const execution = await fetch("/api/automations/http", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: resolvedBody,
            companySlug: activeCompanySlug,
            forwardCookies: scripted.draft.auth.type === "session",
            headers,
            method: scripted.draft.method,
            timeoutMs: 15000,
            url: resolvedUrl,
          }),
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
    setEnvironmentVariableRows(buildKeyValueRows(runtimeEnvironmentRows));
    setLocalVariableRows(buildKeyValueRows(runtimeLocalRows));
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

  function openPostmanImportDialog() {
    postmanFileInputRef.current?.click();
  }

  function importPostmanCollection(rawCollection: string) {
    const parsed = JSON.parse(rawCollection) as PostmanCollectionExport;
    const items = Array.isArray(parsed.item) ? parsed.item : [];
    if (items.length === 0) {
      throw new Error("A coleção não possui requests válidos.");
    }

    const importedRequests = postmanItemsToSavedRequests(items, activeCompanyScope);
    if (importedRequests.length === 0) {
      throw new Error("Nenhum request foi encontrado na coleção.");
    }

    const nextRequests = [...importedRequests, ...savedRequests];
    persistSavedRequests(nextRequests);
    setSelectedPresetId(importedRequests[0].id);
    applyPreset(importedRequests[0]);
    setSidebarView("collection");
    setPostmanImportError(null);
    setPostmanImportFeedback(`Coleção "${parsed.info?.name ?? "Postman"}" importada com ${importedRequests.length} requests.`);
    window.setTimeout(() => setPostmanImportFeedback(null), 2000);
  }

  function handlePostmanFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPostmanImportError(null);
    setPostmanImportFeedback(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        importPostmanCollection(String(reader.result ?? ""));
        if (postmanFileInputRef.current) {
          postmanFileInputRef.current.value = "";
        }
      } catch (error) {
        setPostmanImportError(error instanceof Error ? error.message : "Falha ao importar a coleção.");
      }
    };
    reader.onerror = () => {
      setPostmanImportError("Não foi possível ler o arquivo selecionado.");
    };
    reader.readAsText(file);
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-sm">
      <div className="shrink-0 flex items-center gap-3 border-b border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-2 sm:px-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-(--tc-text,#0b1a3c)">
          <FiServer className="h-3.5 w-3.5 text-(--tc-accent,#ef0001)" />
          API Lab
        </div>
        <div className="h-3.5 w-px bg-(--tc-border,#d7deea)" />
        <span className="text-xs text-(--tc-text-muted,#6b7280)">{authLabel(auth)}</span>
        {mockEnabled ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <FiToggleRight className="h-3 w-3" />
            Mock {mockStatus}
          </span>
        ) : null}
      </div>

      <input
        ref={postmanFileInputRef}
        type="file"
        accept=".json,application/json"
        aria-label="Selecionar coleção JSON"
        title="Selecionar coleção JSON"
        className="hidden"
        onChange={handlePostmanFileChange}
      />

      <div className="flex flex-1 min-h-0">
        <aside className="hidden xl:flex w-64 shrink-0 flex-col overflow-hidden border-r border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc)">
          {/* Sidebar tab bar */}
          <div className="shrink-0 flex gap-1 border-b border-(--tc-border,#d7deea) p-2">
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
                  className={`flex-1 min-h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${sidebarView === tab.id ? "bg-(--tc-surface,#ffffff) text-(--tc-accent,#ef0001) shadow-sm" : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text,#0b1a3c)"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Collection toolbar (sticky, outside scroll) ── */}
          {sidebarView === "collection" && (
            <div className="shrink-0 px-3 py-2 border-b border-(--tc-border,#d7deea)">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Coleção</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                    {visiblePresets.length}
                  </span>
                  <button
                    type="button"
                    onClick={openPostmanImportDialog}
                    title="Importar coleção do Postman (.json)"
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-2.5 text-[11px] font-semibold text-(--tc-text,#0b1a3c) hover:bg-(--tc-surface-2,#f8fafc) transition"
                  >
                    <FiUploadCloud className="h-3 w-3" />
                    Importar
                  </button>
                  {savedRequests.length > 0 ? (
                    <button
                      type="button"
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
              <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">
                Coleção da empresa: <span className="font-semibold text-(--tc-text,#0b1a3c)">{selectedCompany?.name ?? "empresa atual"}</span>
              </p>
            </div>
          )}

          {/* ── Runner toolbar (sticky, outside scroll) ── */}
          {sidebarView === "runner" && (
            <div className="shrink-0 px-3 py-2 border-b border-(--tc-border,#d7deea) flex items-center justify-between gap-2">
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
          )}

          {/* ── History toolbar (sticky, outside scroll) ── */}
          {sidebarView === "history" && (
            <div className="shrink-0 px-3 py-2 border-b border-(--tc-border,#d7deea) flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Histórico</p>
                <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  {selectedCompany?.name ?? "Empresa atual"}
                </p>
              </div>
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
          )}

          {/* ── Scrollable list ── */}
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
          {/* Collection list */}
          {sidebarView === "collection" ? (
            <div>
              {visiblePresets.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  const isSaved = "source" in preset && preset.source === "saved";
                  const methodColor =
                    preset.method === "GET" ? "text-emerald-600" :
                    preset.method === "POST" ? "text-amber-600" :
                    preset.method === "PUT" ? "text-blue-600" :
                    preset.method === "PATCH" ? "text-violet-600" :
                    preset.method === "DELETE" || preset.method === "DEL" ? "text-rose-600" :
                    "text-(--tc-text-muted,#6b7280)";
                  return (
                    <div key={preset.id} className={`group rounded-lg transition ${active ? "bg-(--tc-surface,#ffffff) shadow-sm" : "hover:bg-(--tc-surface,#ffffff)/60"}`}>
                      <button type="button" onClick={() => applyPreset(preset)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left">
                        <span className={`shrink-0 w-9 text-[10px] font-bold text-right ${methodColor}`}>
                          {preset.method}
                        </span>
                        <span className="truncate text-sm text-(--tc-text,#0b1a3c)">{preset.title}</span>
                        {isSaved ? <FiDatabase className="ml-auto shrink-0 h-3.5 w-3.5 text-(--tc-accent,#ef0001)" /> : null}
                      </button>
                      {isSaved ? (
                        <div className="pl-11 pr-2 pb-1">
                          <button
                            type="button"
                            onClick={() => removeSavedRequest(preset.id)}
                            className="inline-flex items-center gap-1 text-xs text-(--tc-text-muted,#6b7280) opacity-0 group-hover:opacity-100 transition"
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
          ) : null}

          {/* Runner list */}
          {sidebarView === "runner" ? (
            <div>
              {runnerResults.length === 0 && !runnerRunning ? (
                <p className="mt-4 text-center text-sm text-(--tc-text-muted,#6b7280)">Clique em Run All na aba Coleção para executar.</p>
              ) : (
                <div className="space-y-2">
                  {runnerResults.map((result) => {
                    const allPassed = result.assertionResults.length > 0 && result.assertionResults.every((r) => r.passed);
                    const anyFailed = result.assertionResults.some((r) => !r.passed);
                    const isOk = !result.error && result.status !== null && result.status < 400;
                    const statusColor = result.error ? "border-rose-300 bg-rose-50" : anyFailed ? "border-amber-300 bg-amber-50" : allPassed || isOk ? "border-emerald-300 bg-emerald-50" : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)";
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
                    <div className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-3 text-sm text-(--tc-text-muted,#6b7280) opacity-70 animate-pulse">
                      Executando próximo request…
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {/* History list */}
          {sidebarView === "history" ? (
            <div>
              {history.length === 0 ? (
                <p className="mt-4 text-center text-sm text-(--tc-text-muted,#6b7280)">Nenhuma execução registrada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => {
                    const isOk = !entry.error && entry.status !== null && entry.status < 400;
                    const anyFailed = entry.assertionTotal > 0 && entry.assertionPassed < entry.assertionTotal;
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-xl border px-3 py-2 ${entry.error ? "border-rose-200 bg-rose-50" : anyFailed ? "border-amber-200 bg-amber-50" : isOk ? "border-emerald-200 bg-emerald-50" : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)"}`}
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
            </div>
          ) : null}
          </div>
        </aside>

        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          <div className="shrink-0 p-4 sm:p-5">
          {/* ── Breadcrumb / request name ── */}
          <div className="mb-3 flex items-center gap-1.5 text-xs text-(--tc-text-muted,#6b7280)">
            <span className="font-medium">{currentEnvironment?.title}</span>
            <span>/</span>
            <input
              value={requestName}
              onChange={(event) => setRequestName(event.target.value)}
              className="min-w-0 flex-1 bg-transparent font-semibold text-(--tc-text,#0b1a3c) outline-none placeholder:text-(--tc-text-muted,#6b7280)"
              placeholder="Nome do request"
            />
            {isDirty && (
              <>
                <button
                  type="button"
                  onClick={saveCurrentRequest}
                  title="Salvar (Ctrl+S)"
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-white shadow shadow-amber-200 transition hover:bg-amber-500 active:scale-95"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-(--tc-surface,#ffffff)/80" />
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={discardChanges}
                  title="Descartar alteracoes"
                  className="inline-flex items-center rounded-full bg-(--tc-primary,#011848) px-3 py-1 text-[11px] font-semibold text-white/80 transition hover:text-white active:scale-95"
                >
                  Descartar
                </button>
              </>
            )}
          </div>

          {/* ── Postman-style URL bar ── */}
          <div className="flex items-stretch overflow-hidden rounded-lg border border-(--tc-border,#d7deea)">
            <select
              aria-label="Método HTTP"
              value={method}
              onChange={(event) => setMethod(event.target.value as AutomationHttpMethod)}
              className={`shrink-0 border-r border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-sm font-bold outline-none ${
                method === "GET" ? "text-emerald-600" :
                method === "POST" ? "text-amber-600" :
                method === "PUT" ? "text-blue-600" :
                method === "PATCH" ? "text-violet-600" :
                method === "DELETE" || method === "DEL" ? "text-rose-600" :
                "text-(--tc-text,#0b1a3c)"
              }`}
            >
              {AUTOMATION_IDE_METHODS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <UrlVarInput
              value={path}
              onChange={setPath}
              resolvedVariables={resolvedVariables}
              varSourceMap={varSourceMap}
              placeholder={`${currentEnvironment.baseUrl}/api/...`}
              inputClassName="w-full bg-(--tc-surface,#ffffff) px-4 py-2.5 text-sm outline-none placeholder:text-(--tc-text-muted,#6b7280)/60"
            />
            <button
              type="button"
              onClick={executeRequest}
              disabled={loading}
              className="shrink-0 bg-(--tc-primary,#011848) px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition hover:opacity-90"
            >
              {loading ? "…" : "Executar"}
            </button>
          </div>

          {/* ── Secondary settings: Ambiente + Base URL ── */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Ambiente"
              value={selectedEnvironmentId}
              onChange={(event) => setSelectedEnvironmentId(event.target.value)}
              className="rounded-md border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-2 py-1 text-xs font-medium text-(--tc-text,#0b1a3c) outline-none"
            >
              {AUTOMATION_ENVIRONMENTS.map((environment) => (
                <option key={environment.id} value={environment.id}>{environment.title}</option>
              ))}
            </select>
            <input
              value={baseUrlInput}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              placeholder={currentEnvironment.baseUrl}
              className="min-w-0 flex-1 rounded-md border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-2 py-1 font-mono text-xs text-(--tc-text,#0b1a3c) outline-none placeholder:text-(--tc-text-muted,#6b7280)/60"
            />
            <p className="font-mono text-xs text-(--tc-text-muted,#6b7280) truncate max-w-xs">→ {resolvedUrlPreview}</p>
          </div>

          {missingVariableKeys.length > 0 ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Variáveis pendentes: {missingVariableKeys.join(", ")}
            </div>
          ) : null}

          {/* ── Postman-style underline tab bar ── */}
          <div className="mt-4 flex overflow-x-auto border-b border-(--tc-border,#d7deea)">
            {[
              { id: "params" as const, label: "Params", dot: queryRows.some(r => r.key) },
              { id: "auth" as const, label: "Auth", dot: auth.type !== "none" },
              { id: "variables" as const, label: "Variáveis", dot: false },
              { id: "headers" as const, label: `Headers${headerRows.some(r => r.key) ? ` (${headerRows.filter(r => r.key).length})` : ""}`, dot: false },
              { id: "body" as const, label: "Body", dot: !!body.trim() },
              { id: "scripts" as const, label: "Scripts", dot: !!preRequestScript.trim() },
              { id: "tests" as const, label: assertionRules.length > 0 ? `Tests (${assertionRules.length})` : "Tests", dot: false },
              { id: "import-export" as const, label: "cURL / Export", dot: false },
              { id: "graphql" as const, label: "GraphQL", dot: false },
              { id: "mock" as const, label: "Mock", dot: mockEnabled },
            ].map((tab) => {
              const active = activePanel === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePanel(tab.id)}
                  className={`relative shrink-0 flex items-center gap-1 px-3 pb-2.5 pt-1 text-sm font-medium transition after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 ${
                    active
                      ? "text-(--tc-accent,#ef0001) after:bg-(--tc-accent,#ef0001)"
                      : "text-(--tc-text-muted,#6b7280) after:bg-transparent hover:text-(--tc-text,#0b1a3c)"
                  }`}
                >
                  {tab.label}
                  {tab.dot && <span className="h-1.5 w-1.5 rounded-full bg-(--tc-accent,#ef0001)" />}
                </button>
              );
            })}
          </div>

          {activePanel === "params" ? (
            <section className="mt-4 rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Query params</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Monte a query string sem editar a URL inteira.</p>
                </div>
                <button
                  type="button"
                  aria-label="Adicionar parâmetro"
                  onClick={() => appendKeyValueRow(setQueryRows)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c)"
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
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                    />
                    <VarAutocomplete
                      value={row.value}
                      onChange={(v) => updateKeyValueRow(setQueryRows, row.id, "value", v)}
                      resolvedVariables={resolvedVariables}
                      varSourceMap={varSourceMap}
                      placeholder="valor ou {{variavel}}"
                      wrapperClassName="relative min-w-0"
                      className="min-h-10 w-full rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Remover parâmetro"
                      onClick={() => removeKeyValueRow(setQueryRows, row.id)}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-muted,#6b7280)"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activePanel === "auth" ? (
            <section className="mt-4 rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
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
                    className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer</option>
                    <option value="basic">Basic</option>
                    <option value="api-key">API Key</option>
                    <option value="session">Sessão atual</option>
                  </select>
                </label>

                <div className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
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
                    className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
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
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Senha
                    <input
                      value={auth.password ?? ""}
                      onChange={(event) => setAuth((current) => ({ ...current, password: event.target.value }))}
                      placeholder="senha ou {{password}}"
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
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
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Valor
                    <input
                      value={auth.value ?? ""}
                      onChange={(event) => setAuth((current) => ({ ...current, value: event.target.value }))}
                      placeholder="valor ou {{apiKey}}"
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Inserir em
                    <select
                      value={auth.addTo ?? "header"}
                      onChange={(event) => setAuth((current) => ({ ...current, addTo: event.target.value as "header" | "query" }))}
                      className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
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
              <article className="rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Variáveis do ambiente</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Persistidas por empresa + ambiente selecionado.</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Adicionar variável de ambiente"
                    onClick={() => appendKeyValueRow(setEnvironmentVariableRows)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c)"
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
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateKeyValueRow(setEnvironmentVariableRows, row.id, "value", event.target.value)}
                        placeholder="valor"
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Remover variável de ambiente"
                        onClick={() => removeKeyValueRow(setEnvironmentVariableRows, row.id)}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-muted,#6b7280)"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Variáveis do request</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Sobrescrevem o ambiente só nessa request.</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Adicionar variável do request"
                    onClick={() => appendKeyValueRow(setLocalVariableRows)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c)"
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
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateKeyValueRow(setLocalVariableRows, row.id, "value", event.target.value)}
                        placeholder="12345678900"
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Remover variável do request"
                        onClick={() => removeKeyValueRow(setLocalVariableRows, row.id)}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-muted,#6b7280)"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-3 xl:col-span-2">
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
            <section className="mt-4 rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Headers</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{"Pode usar placeholders como `{{token}}`."}</p>
                </div>
                <button
                  type="button"
                  aria-label="Adicionar header"
                  onClick={() => appendKeyValueRow(setHeaderRows)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c)"
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
                      className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                    />
                    <VarAutocomplete
                      value={row.value}
                      onChange={(v) => updateKeyValueRow(setHeaderRows, row.id, "value", v)}
                      resolvedVariables={resolvedVariables}
                      varSourceMap={varSourceMap}
                      placeholder="Valor ou {{token}}"
                      wrapperClassName="relative min-w-0"
                      className="min-h-10 w-full rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Remover header"
                      onClick={() => removeKeyValueRow(setHeaderRows, row.id)}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-muted,#6b7280)"
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
                className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-slate-800 dark:text-white outline-none"
              />
            </label>
          ) : null}

          {activePanel === "scripts" ? (
            <section className="mt-4 space-y-3">
              <div className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Pre-request script</p>
                <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                  Executa antes do request. Use `pm.variables`, `pm.environment` e `pm.request` para ajustar o que vai ser enviado.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreRequestScript((current) => `${current}${current.trim() ? "\n\n" : ""}pm.variables.set("timestamp", String(Date.now()));`)}
                    className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1.5 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                  >
                    Injetar timestamp
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreRequestScript((current) => `${current}${current.trim() ? "\n\n" : ""}pm.request.headers.upsert({ key: "X-Request-Source", value: "api-lab" });`)}
                    className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1.5 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                  >
                    Header de origem
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreRequestScript((current) => `${current}${current.trim() ? "\n\n" : ""}console.log("pre-request", pm.variables.get("timestamp"));`)}
                    className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1.5 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                  >
                    Log de exemplo
                  </button>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Script
                <textarea
                  value={preRequestScript}
                  onChange={(event) => setPreRequestScript(event.target.value)}
                  rows={12}
                  spellCheck={false}
                  placeholder={`pm.variables.set("timestamp", String(Date.now()));\npm.request.headers.upsert({ key: "X-Request-Source", value: "api-lab" });`}
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-slate-800 dark:text-white outline-none"
                />
              </label>

              <div className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Saída do último script</p>
                {scriptOutput.length === 0 ? (
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">A saída aparece aqui depois da execução.</p>
                ) : (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] px-4 py-3 font-mono text-xs leading-6 text-slate-800">
                    {scriptOutput.join("\n")}
                  </pre>
                )}
              </div>
            </section>
          ) : null}

          {activePanel === "tests" ? (
            <section className="mt-4 rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Assertions</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Executadas automaticamente após cada request.</p>
                </div>
                <button
                  type="button"
                  aria-label="Adicionar assertion"
                  onClick={() => setAssertionRules((prev) => [...prev, createAssertionRule()])}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c)"
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
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
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
                          className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
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
                        className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Remover assertion"
                        onClick={() => setAssertionRules((prev) => prev.filter((r) => r.id !== rule.id))}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-muted,#6b7280)"
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
              <article className="rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Importar Postman</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Cada empresa mantém sua própria coleção neste navegador.</p>
                  </div>
                  <button
                    type="button"
                    onClick={openPostmanImportDialog}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                  >
                    <FiUploadCloud className="h-4 w-4" />
                    Selecionar JSON
                  </button>
                </div>
                <input
                  ref={postmanFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  aria-label="Selecionar coleção JSON"
                  title="Selecionar coleção JSON"
                  className="hidden"
                  onChange={handlePostmanFileChange}
                />
                {postmanImportError ? <p className="mt-2 text-sm font-semibold text-rose-600">{postmanImportError}</p> : null}
                {postmanImportFeedback ? <p className="mt-2 text-sm font-semibold text-emerald-700">{postmanImportFeedback}</p> : null}
              </article>

              <article className="rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
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
                  className="mt-3 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] px-4 py-3 font-mono text-xs leading-6 text-slate-800 dark:text-white outline-none"
                />
                {curlImportError ? (
                  <p className="mt-2 text-sm font-semibold text-rose-600">{curlImportError}</p>
                ) : null}
                <button
                  type="button"
                  onClick={importFromCurl}
                  disabled={!curlImportText.trim()}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) disabled:opacity-50"
                >
                  <FiDownload className="h-4 w-4" />
                  Importar
                </button>
              </article>

              <article className="rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Exportar código</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Gera snippet do request atual com variáveis resolvidas.</p>
                  </div>
                  <div className="flex gap-1 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-1">
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
                <pre className="mt-3 overflow-auto rounded-2xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] px-4 py-3 font-mono text-xs leading-6 text-slate-800 dark:text-white">
                  {getExportSnippet()}
                </pre>
                <button
                  type="button"
                  onClick={copyExportSnippet}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  <FiCopy className="h-4 w-4" />
                  Copiar código
                </button>
              </article>
            </section>
          ) : null}

          {activePanel === "graphql" ? (
            <section className="mt-4 space-y-3">
              <div className="rounded-xl bg-(--tc-surface-2,#f8fafc) p-3">
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
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-slate-800 dark:text-white outline-none"
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
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-slate-800 dark:text-white outline-none"
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
            <section className="mt-4 rounded-xl bg-(--tc-surface-2,#f8fafc) p-3 space-y-3">
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
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${mockEnabled ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c)"}`}
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
                  className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm outline-none"
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
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-slate-800 dark:text-white outline-none"
                />
              </label>
{mockEnabled ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
                  Mock ativo — próxima execução usará essa resposta simulada.
                </div>
              ) : null}
            </section>
          ) : null}
          </div>

          <div className="flex flex-col border-t border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4 sm:p-5">
          {/* Postman-style Response header row */}
          <div className="flex items-center justify-between gap-2 border-b border-(--tc-border,#d7deea) pb-2">
            <div className="flex items-center gap-0">
              <span className="pr-4 text-sm font-semibold text-(--tc-text,#0b1a3c) border-b-2 border-(--tc-accent,#ef0001) pb-2 -mb-2">Response</span>
              {response && (
                <div className="ml-4 flex items-center gap-3 text-xs text-(--tc-text-muted,#6b7280)">
                  <span className={`font-semibold ${response.status < 300 ? "text-emerald-600" : response.status < 400 ? "text-amber-600" : "text-rose-600"}`}>
                    {response.status} {response.statusText}
                  </span>
                  <span>{response.durationMs} ms</span>
                  <span className="truncate max-w-48 font-mono">{response.url}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Copiar resposta"
              onClick={copyResponse}
              disabled={!response}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c) disabled:opacity-40 transition hover:bg-(--tc-surface-2,#f8fafc)"
            >
              <FiCopy className="h-3.5 w-3.5" />
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{errorMessage}</div>
          ) : null}
          {copyFeedback ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{copyFeedback}</div>
          ) : null}

          <div className="mt-3 flex overflow-x-auto border-b border-(--tc-border,#d7deea)">
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
                className={`relative shrink-0 px-3 pb-2.5 pt-1 text-sm font-medium transition after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 ${responseTab === tab.id ? "text-(--tc-accent,#ef0001) after:bg-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280) after:bg-transparent hover:text-(--tc-text,#0b1a3c)"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-60 rounded-xl border border-(--tc-border,#d7deea) bg-[#f6f8fa] dark:bg-[#081227] p-4">
            {responseTab === "tests" ? (
              assertionResults.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-white/60">
                  {assertionRules.length === 0
                    ? "Adicione assertions na aba Tests e execute o request."
                    : "Execute o request para ver os resultados."}
                </p>
              ) : (
                <div className="space-y-2">
                  {assertionResults.map((result) => (
                    <div
                      key={result.ruleId}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${result.passed ? "border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/60" : "border-rose-200 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/60"}`}
                    >
                      {result.passed ? (
                        <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <FiXCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${result.passed ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{result.label}</p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-white/50">obtido: {result.actual || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-slate-700 dark:text-slate-300">
                {responseTab === "raw"
                  ? (response?.text || <span className="text-slate-400 dark:text-slate-500 italic">vazio</span>)
                  : colorizeJson(
                      JSON.stringify(
                        responseTab === "headers" ? (response?.headers ?? {}) : (response?.json ?? null),
                        null,
                        2,
                      ),
                    )}
              </pre>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-(--tc-text-muted,#6b7280)">
            <FiClock className="h-4 w-4" />
            BFF interno para request com auth, params e variáveis sem abrir Postman.
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
