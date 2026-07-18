import "server-only";

import { randomUUID } from "crypto";
import { mkdir, readFile, appendFile } from "fs/promises";
import { dirname, join } from "path";

const STORE_PATH = process.env.BRAIN_EMAIL_FLOW_FILE || join(process.cwd(), "data", "brain-email-flow.jsonl");
const ACCESS_REQUEST_SUBJECT_HINTS = [
  "solicitação de acesso",
  "solicitacao de acesso",
  "acesso empresarial",
  "usuário da empresa",
  "usuario da empresa",
  "usuário tc",
  "usuario tc",
  "líder tc",
  "lider tc",
  "suporte técnico",
  "suporte tecnico",
  "gestor de plataforma",
];

export type BrainEmailFlowKind =
  | "access_request.received"
  | "access_request.approved"
  | "access_request.rejected"
  | "access_request.adjustment"
  | "password.reset"
  | "welcome"
  | "generic";

export type BrainEmailFlowEntry = {
  id: string;
  createdAt: string;
  kind: BrainEmailFlowKind;
  to: string;
  subject: string;
  html: string;
  text: string | null;
  accessKey: string | null;
  lookupUrl: string | null;
  requestId: string | null;
  source: "emailService" | "captureFile";
  metadata?: Record<string, unknown>;
};

type BrainEmailFlowInput = {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  source?: BrainEmailFlowEntry["source"];
  metadata?: Record<string, unknown>;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeSubject(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classifyEmail(subject: string): BrainEmailFlowKind {
  const normalized = normalizeSubject(subject);
  if (normalized.includes("redefinir senha") || normalized.includes("senha")) return "password.reset";
  if (normalized.includes("dados de acesso") || normalized.includes("bem-vindo")) return "welcome";
  if (!ACCESS_REQUEST_SUBJECT_HINTS.some((hint) => normalized.includes(normalizeSubject(hint)))) return "generic";
  if (normalized.includes("recebida")) return "access_request.received";
  if (normalized.includes("aprovad")) return "access_request.approved";
  if (normalized.includes("recusad") || normalized.includes("rejeitad")) return "access_request.rejected";
  if (normalized.includes("ajuste") || normalized.includes("corrig") || normalized.includes("informacao")) return "access_request.adjustment";
  return "generic";
}

function extractLookupUrl(html: string, text?: string | null) {
  const content = `${html}\n${text ?? ""}`;
  const hrefMatch = content.match(/https?:\/\/[^\s"'<>]+\/login\/access-request\/status\?key=[^\s"'<>]+/i);
  if (hrefMatch?.[0]) return hrefMatch[0].replace(/&amp;/g, "&");
  const relativeMatch = content.match(/\/login\/access-request\/status\?key=[^\s"'<>]+/i);
  return relativeMatch?.[0]?.replace(/&amp;/g, "&") ?? null;
}

function extractAccessKey(html: string, text?: string | null) {
  const lookupUrl = extractLookupUrl(html, text);
  if (lookupUrl) {
    try {
      const parsed = lookupUrl.startsWith("http")
        ? new URL(lookupUrl)
        : new URL(lookupUrl, "http://local.quality-control"); // NOSONAR: parser-only placeholder base, no request is made
      const key = parsed.searchParams.get("key");
      if (key) return key;
    } catch {
      // segue tentando por regex abaixo
    }
  }

  const content = `${html}\n${text ?? ""}`;
  const explicitCode = content.match(/Código de consulta[^\w]{1,80}([a-f0-9]{16,80})/i)?.[1];
  if (explicitCode) return explicitCode;
  return content.match(/\b[a-f0-9]{32,80}\b/i)?.[0] ?? null;
}

function safeParseJsonLine(line: string) {
  try {
    const parsed = JSON.parse(line) as Partial<BrainEmailFlowEntry> & {
      at?: string;
      to?: string;
      subject?: string;
      html?: string;
      text?: string | null;
    };
    return parsed;
  } catch {
    return null;
  }
}

function normalizeCapturedLine(parsed: ReturnType<typeof safeParseJsonLine>): BrainEmailFlowEntry | null {
  if (!parsed) return null;
  const subject = normalizeText(parsed.subject);
  const to = normalizeText(parsed.to);
  const html = typeof parsed.html === "string" ? parsed.html : "";
  if (!subject || !to) return null;
  const text = typeof parsed.text === "string" ? parsed.text : null;
  return {
    id: normalizeText(parsed.id) || randomUUID(),
    createdAt: normalizeText(parsed.createdAt) || normalizeText(parsed.at) || new Date().toISOString(),
    kind: (normalizeText(parsed.kind) as BrainEmailFlowKind) || classifyEmail(subject),
    to,
    subject,
    html,
    text,
    accessKey: parsed.accessKey === null || typeof parsed.accessKey === "string" ? parsed.accessKey ?? extractAccessKey(html, text) : extractAccessKey(html, text),
    lookupUrl: parsed.lookupUrl === null || typeof parsed.lookupUrl === "string" ? parsed.lookupUrl ?? extractLookupUrl(html, text) : extractLookupUrl(html, text),
    requestId: parsed.requestId === null || typeof parsed.requestId === "string" ? parsed.requestId ?? null : null,
    source: parsed.source === "captureFile" || parsed.source === "emailService" ? parsed.source : "captureFile",
    metadata: parsed.metadata && typeof parsed.metadata === "object" && !Array.isArray(parsed.metadata) ? parsed.metadata as Record<string, unknown> : undefined,
  };
}

export async function recordBrainEmailFlow(input: BrainEmailFlowInput) {
  try {
    const subject = normalizeText(input.subject);
    const to = normalizeText(input.to);
    if (!subject || !to) return null;

    const entry: BrainEmailFlowEntry = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      kind: classifyEmail(subject),
      to,
      subject,
      html: input.html ?? "",
      text: input.text ?? null,
      accessKey: extractAccessKey(input.html ?? "", input.text),
      lookupUrl: extractLookupUrl(input.html ?? "", input.text),
      requestId: null,
      source: input.source ?? "emailService",
      metadata: input.metadata,
    };

    await mkdir(dirname(STORE_PATH), { recursive: true });
    await appendFile(STORE_PATH, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  } catch (error) {
    console.warn("[BRAIN_EMAIL_FLOW] Falha ao registrar email", error);
    return null;
  }
}

export async function listBrainEmailFlow(limit = 200) {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => normalizeCapturedLine(safeParseJsonLine(line)))
      .filter((entry): entry is BrainEmailFlowEntry => Boolean(entry));

    const deduped = new Map<string, BrainEmailFlowEntry>();
    for (const entry of entries) {
      const key = `${entry.createdAt}:${entry.to}:${entry.subject}:${entry.accessKey ?? ""}`;
      deduped.set(key, entry);
    }

    return Array.from(deduped.values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, Math.max(1, Math.min(500, limit)));
  } catch {
    return [];
  }
}

export function isAccessRequestEmail(entry: BrainEmailFlowEntry) {
  return entry.kind.startsWith("access_request.");
}

