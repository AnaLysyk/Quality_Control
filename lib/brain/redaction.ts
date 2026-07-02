import type { BrainNode } from "@prisma/client";

import type { BrainRuntimeContext } from "@/lib/brain/runtime";
import { hasPermissionAccess } from "@/lib/permissionMatrix";

const SENSITIVE_KEYS = new Set([
  "email",
  "cpf",
  "cnpj",
  "token",
  "apiKey",
  "secret",
  "password",
  "evidence",
  "internal_notes",
  "internalNotes",
  "financial",
]);

function canViewSensitiveField(context: BrainRuntimeContext, key: string) {
  if (key.toLowerCase().includes("token") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("password")) {
    return false;
  }
  if (hasPermissionAccess(context.effectivePermissions, "audit", "view")) return true;
  if (["email", "cpf", "cnpj"].includes(key)) {
    return hasPermissionAccess(context.effectivePermissions, "users", "view_all");
  }
  return hasPermissionAccess(context.effectivePermissions, "brain", "use");
}

function maskValue(key: string, value: unknown) {
  if (value === null || value === undefined) return value;
  if (key === "email" && typeof value === "string") {
    const [, domain] = value.split("@");
    return domain ? `***@${domain}` : "***";
  }
  if (typeof value === "string") return value.length ? "***" : value;
  return "oculto";
}

export function redactBrainMetadataForUser(
  context: BrainRuntimeContext,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.trim();
    const lowerKey = normalizedKey.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.has(normalizedKey) || SENSITIVE_KEYS.has(lowerKey);

    if (isSensitive && !canViewSensitiveField(context, normalizedKey)) {
      output[key] = maskValue(lowerKey, value);
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = redactBrainMetadataForUser(context, value as Record<string, unknown>);
      continue;
    }

    if (Array.isArray(value)) {
      output[key] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? redactBrainMetadataForUser(context, item as Record<string, unknown>)
          : item,
      );
      continue;
    }

    output[key] = value;
  }
  return output;
}

export function redactBrainNodeForUser<T extends Pick<BrainNode, "metadata">>(
  context: BrainRuntimeContext,
  node: T,
): T {
  const metadata = node.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata)
    ? node.metadata as Record<string, unknown>
    : {};

  return {
    ...node,
    metadata: redactBrainMetadataForUser(context, metadata),
  };
}

