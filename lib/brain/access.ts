import type { BrainEdge, BrainNode } from "@prisma/client";

import { prisma } from "@/lib/prismaClient";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

export type BrainAccessContext = {
  user: AuthUser;
  hasGlobalVisibility: boolean;
  canManage: boolean;
  allowedCompanySlugs: Set<string>;
  allowedCompanyIds: Set<string>;
};

export type BrainAccessResult =
  | { ok: true; context: BrainAccessContext }
  | { ok: false; status: 401 | 403; error: string };

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSlug(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveAllowedCompanySlugs(user: AuthUser) {
  const slugs = Array.isArray(user.companySlugs) ? user.companySlugs : user.companySlug ? [user.companySlug] : [];
  return slugs
    .map((slug) => normalizeSlug(slug))
    .filter((slug): slug is string => Boolean(slug));
}

function hasGlobalBrainVisibility(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const roles = [user.role, user.companyRole, user.permissionRole]
    .map((value) => normalizeString(value)?.toLowerCase())
    .filter((value): value is string => Boolean(value));
  return roles.includes("leader_tc") || roles.includes("technical_support");
}

export async function resolveBrainAccess(req: Request, options?: { requireManage?: boolean }): Promise<BrainAccessResult> {
  const user = await authenticateRequest(req);
  if (!user) return { ok: false, status: 401, error: "Nao autorizado" };

  const hasGlobalVisibility = hasGlobalBrainVisibility(user);
  const canManage = hasGlobalVisibility;

  if (options?.requireManage && !canManage) {
    return { ok: false, status: 403, error: "Sem permissao" };
  }

  const allowedCompanySlugs = new Set(resolveAllowedCompanySlugs(user));
  const allowedCompanyIds = new Set<string>();

  if (user.companyId) {
    allowedCompanyIds.add(user.companyId);
  }

  if (!hasGlobalVisibility && allowedCompanySlugs.size > 0) {
    const companies = await prisma.company.findMany({
      where: { slug: { in: Array.from(allowedCompanySlugs) } },
      select: { id: true },
    });
    for (const company of companies) {
      allowedCompanyIds.add(company.id);
    }
  }

  if (!hasGlobalVisibility && allowedCompanySlugs.size === 0 && allowedCompanyIds.size === 0) {
    return { ok: false, status: 403, error: "Sem escopo de empresa para acessar o Brain" };
  }

  return {
    ok: true,
    context: {
      user,
      hasGlobalVisibility,
      canManage,
      allowedCompanySlugs,
      allowedCompanyIds,
    },
  };
}

export function isBrainNodeVisible(node: Pick<BrainNode, "type" | "refType" | "refId" | "metadata">, access: BrainAccessContext) {
  if (access.hasGlobalVisibility) return true;

  const metadata = toRecord(node.metadata);
  const metadataCompanyId = normalizeString(metadata.companyId);
  const metadataCompanySlug = normalizeSlug(metadata.companySlug);

  if (node.refType === "Company" && node.refId && access.allowedCompanyIds.has(node.refId)) {
    return true;
  }

  if (node.type === "Company") {
    const companySlug = normalizeSlug(metadata.slug);
    if (companySlug && access.allowedCompanySlugs.has(companySlug)) return true;
  }

  if (metadataCompanyId && access.allowedCompanyIds.has(metadataCompanyId)) return true;
  if (metadataCompanySlug && access.allowedCompanySlugs.has(metadataCompanySlug)) return true;

  return false;
}

export function filterBrainGraphByAccess(
  nodes: Array<Pick<BrainNode, "id" | "type" | "refType" | "refId" | "metadata">>,
  edges: Array<Pick<BrainEdge, "id" | "fromId" | "toId">>,
  access: BrainAccessContext,
) {
  if (access.hasGlobalVisibility) {
    return {
      visibleNodeIds: new Set(nodes.map((node) => node.id)),
      visibleEdgeIds: new Set(edges.map((edge) => edge.id)),
    };
  }

  const visibleNodeIds = new Set(
    nodes
      .filter((node) => isBrainNodeVisible(node, access))
      .map((node) => node.id),
  );

  const visibleEdgeIds = new Set(
    edges
      .filter((edge) => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId))
      .map((edge) => edge.id),
  );

  return { visibleNodeIds, visibleEdgeIds };
}

export async function assertBrainNodeAccess(nodeId: string, access: BrainAccessContext) {
  const node = await prisma.brainNode.findUnique({ where: { id: nodeId } });
  if (!node) return { ok: false as const, status: 404 as const, error: "No nao encontrado" };
  if (!isBrainNodeVisible(node, access)) {
    return { ok: false as const, status: 403 as const, error: "Sem permissao para acessar este no" };
  }
  return { ok: true as const, node };
}
