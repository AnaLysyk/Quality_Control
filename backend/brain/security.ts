import type { BrainAccessContext } from "@/backend/brain/access";

const SENSITIVE_KEY_PATTERNS = [
  "password",
  "senha",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "credential",
  "credentials",
  "authorization",
  "cookie",
  "session",
  "hash",
  "privateKey",
  "private_key",
  "qase_token",
  "jira_api_token",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSlug(value: unknown) {
  return normalizeString(value)?.toLowerCase() ?? null;
}

function isSensitiveKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (isSensitiveKey(key)) return "[REDACTED]";

  if (typeof value === "string") {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return maskEmail(value);
    if (value.length > 240) return `${value.slice(0, 240)}...`;
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeBrainValue(key, item));
  }

  if (isRecord(value)) {
    return sanitizeBrainMetadata(value);
  }

  return value;
}

function sanitizeBrainValue(key: string, value: unknown): unknown {
  return maskValue(key, value);
}

export function sanitizeBrainMetadata(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};

  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    safe[key] = sanitizeBrainValue(key, item);
  }
  return safe;
}

export function sanitizeBrainText(value: unknown, maxLength = 800) {
  const text = normalizeString(value);
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function rowCompanyMatches(row: Record<string, unknown>, access: BrainAccessContext) {
  if (access.hasGlobalVisibility) return true;

  const companyId =
    normalizeString(row.companyId) ??
    normalizeString(row.company_id) ??
    normalizeString(row.clientId) ??
    normalizeString(row.client_id);

  const companySlug =
    normalizeSlug(row.companySlug) ??
    normalizeSlug(row.company_slug) ??
    normalizeSlug(row.slug) ??
    normalizeSlug(row.clientSlug) ??
    normalizeSlug(row.client_slug);

  if (!companyId && !companySlug) return false;
  if (companyId && access.allowedCompanyIds.has(companyId)) return true;
  if (companySlug && access.allowedCompanySlugs.has(companySlug)) return true;

  return false;
}

export function isBrainOptionalRowVisible(row: unknown, access: BrainAccessContext) {
  if (!isRecord(row)) return false;
  return rowCompanyMatches(row, access);
}

export function sanitizeBrainOptionalMemoryItem<T extends Record<string, unknown>>(item: T) {
  return sanitizeBrainMetadata(item) as T;
}

export async function auditBrainQuery(params: {
  prisma: unknown;
  access: BrainAccessContext;
  action: string;
  entityType: string;
  resultCount?: number;
  memoryCount?: number;
  moduleFilter?: string | null;
  hasQuery?: boolean;
}) {
  const db = params.prisma as {
    brainAuditLog?: {
      create?: (args: unknown) => Promise<unknown>;
    };
  };

  await db.brainAuditLog?.create?.({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.access.user.id ?? params.access.user.email ?? "unknown",
      userId: params.access.user.id ?? null,
      reason: "brain-security-context",
      after: {
        resultCount: params.resultCount ?? 0,
        memoryCount: params.memoryCount ?? 0,
        moduleFilter: params.moduleFilter ?? null,
        hasQuery: params.hasQuery === true,
        role: params.access.user.permissionRole ?? params.access.user.role ?? params.access.user.companyRole ?? null,
        global: params.access.hasGlobalVisibility,
        companyScopeCount: params.access.allowedCompanyIds.size + params.access.allowedCompanySlugs.size,
      },
    },
  }).catch(() => null);
}
