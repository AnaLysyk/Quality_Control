import {
  BRIAN_ENTITY_ALIASES,
  BRIAN_IMPULSE_ALIASES,
  isBrianImpulseType,
  isBrianNeuronKind,
} from "./contracts";
import type { BrianContextCarrier, BrianImpulseType, BrianNeuronKind } from "./types";

export type BrianNormalizedEntity = {
  canonicalType: BrianNeuronKind;
  originalType: string;
  entityId: string;
  title: string;
  sourceModule: string;
};

function slugPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

export function normalizeEntityKind(value: unknown): BrianNeuronKind {
  const raw = normalizeText(value, "ticket");
  const key = slugPart(raw);
  const dotted = key.replace(/_/g, ".");
  if (isBrianNeuronKind(raw)) return raw;
  if (isBrianNeuronKind(key)) return key;
  if (isBrianNeuronKind(dotted)) return dotted;
  return BRIAN_ENTITY_ALIASES[key] ?? BRIAN_ENTITY_ALIASES[raw.toLowerCase()] ?? "ticket";
}

export function normalizeImpulseType(value: unknown): BrianImpulseType {
  const raw = normalizeText(value, "ticket.updated");
  const lower = raw.trim().toLowerCase();
  const dotted = lower.replace(/[\s:/-]+/g, ".").replace(/_+/g, ".");
  const aliasKey = lower.replace(/[\s:/.-]+/g, "_");
  if (isBrianImpulseType(lower)) return lower;
  if (isBrianImpulseType(dotted)) return dotted;
  return BRIAN_IMPULSE_ALIASES[aliasKey] ?? "ticket.updated";
}

export function normalizeEntity(input: {
  type: unknown;
  id: unknown;
  title?: unknown;
  sourceModule?: unknown;
}): BrianNormalizedEntity {
  const canonicalType = normalizeEntityKind(input.type);
  const entityId = normalizeText(input.id, "unknown");
  const title = normalizeText(input.title, `${canonicalType}:${entityId}`);
  const sourceModule = normalizeText(input.sourceModule, canonicalType);
  return {
    canonicalType,
    originalType: normalizeText(input.type, canonicalType),
    entityId,
    title,
    sourceModule,
  };
}

export function canonicalNeuronId(kind: BrianNeuronKind, entityId: string, companyId?: string | null) {
  const companyPart = companyId ? `${slugPart(companyId)}__` : "";
  return `${kind}__${companyPart}${slugPart(entityId || "unknown")}`;
}

export function stableId(prefix: string, parts: Array<string | null | undefined>) {
  const body = parts.map((part) => slugPart(part ?? "none")).filter(Boolean).join("__");
  return `${prefix}__${body || "unknown"}`;
}

export function inferRouteContext(pathname?: string | null): Partial<BrianContextCarrier> {
  const path = normalizeText(pathname, "/");
  const segments = path.split("/").filter(Boolean);
  const empresasIndex = segments.findIndex((item) => item === "empresas");
  const companySlug = empresasIndex >= 0 ? segments[empresasIndex + 1] ?? null : null;
  const applicationKey = empresasIndex >= 0 ? segments[empresasIndex + 2] ?? null : null;
  const moduleKey =
    empresasIndex >= 0
      ? segments[empresasIndex + 3] ?? segments[empresasIndex + 2] ?? null
      : segments[0] === "admin"
        ? segments[1] ?? null
        : segments[0] ?? null;
  const screenKey = segments.at(-1) ?? null;
  return {
    pathname: path,
    companySlug,
    applicationKey,
    moduleKey,
    screenKey,
  };
}

export function normalizeContextCarrier(input: Partial<BrianContextCarrier>): BrianContextCarrier {
  const route = inferRouteContext(input.pathname);
  const userId = normalizeText(input.userId, "anonymous");
  const timestamp = Date.now().toString(36);
  return {
    traceId: normalizeText(input.traceId, `trace_${timestamp}_${slugPart(userId)}`),
    sessionId: normalizeText(input.sessionId, `session_${slugPart(userId)}`),
    pathname: normalizeText(input.pathname, route.pathname ?? "/"),
    companySlug: input.companySlug ?? route.companySlug ?? null,
    companyId: input.companyId ?? null,
    applicationKey: input.applicationKey ?? route.applicationKey ?? null,
    moduleKey: input.moduleKey ?? route.moduleKey ?? null,
    screenKey: input.screenKey ?? route.screenKey ?? null,
    selectedEntityId: input.selectedEntityId ?? null,
    userId,
    role: normalizeText(input.role, "company_user").toLowerCase(),
    permissions: Array.isArray(input.permissions) ? input.permissions.filter((item) => typeof item === "string") : [],
  };
}

