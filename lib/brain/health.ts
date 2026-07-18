import "server-only";

import type { BrainAccessContext } from "@/lib/brain/access";
import { qaseBrainSource } from "@/lib/brain/integrations/qaseSource";
import { jiraBrainSource } from "@/lib/brain/integrations/jiraSource";
import type { BrainGraphSourceHealth } from "@/lib/brain/sources";
import { PERMISSION_MODULES } from "@/lib/permissionCatalog";
import { canAccess } from "@/lib/permissions/can-access";
import { prisma } from "@/database/prismaClient";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";

function sourceStatusByPermission(access: BrainAccessContext | null, moduleId: string, action = "view") {
  if (!access) return "ok" as const;
  if (access.user.isGlobalAdmin) return "ok" as const;
  return canAccess(access.userAccess, { moduleId, action }) ? "ok" as const : "blocked_by_permission" as const;
}

async function safeSource(input: Promise<BrainGraphSourceHealth>, fallback: Pick<BrainGraphSourceHealth, "id" | "label">) {
  try {
    return await input;
  } catch (error) {
    return {
      ...fallback,
      status: "error" as const,
      nodes: 0,
      edges: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getBrainHealth(access: BrainAccessContext | null = null) {
  const [nodes, edges, memories, auditEvents, companies, projects, users] = await Promise.all([
    prisma.brainNode.count().catch(() => 0),
    prisma.brainEdge.count().catch(() => 0),
    prisma.brainMemory.count().catch(() => 0),
    prisma.brainAuditLog.count().catch(() => 0),
    prisma.company.count({ where: { active: true } }).catch(() => 0),
    prisma.project.count({ where: { archivedAt: null } }).catch(() => 0),
    prisma.user.count().catch(() => 0),
  ]);

  const companySlug =
    access?.userAccess.companySlug ??
    (access?.allowedCompanySlugs.size === 1 ? Array.from(access.allowedCompanySlugs)[0] : null);

  const staticSources: BrainGraphSourceHealth[] = [
    {
      id: "modules",
      label: "Modulos",
      status: "ok",
      nodes: PERMISSION_MODULES.length,
      edges: PERMISSION_MODULES.reduce((total, item) => total + item.actions.length, 0),
    },
    {
      id: "routes",
      label: "Rotas",
      status: "ok",
      nodes: SYSTEM_ROUTES.length,
      edges: SYSTEM_ROUTES.filter((route) => route.requiredPermission).length,
    },
    {
      id: "permissions",
      label: "Permissoes",
      status: sourceStatusByPermission(access, "permissions"),
      nodes: PERMISSION_MODULES.length,
      edges: PERMISSION_MODULES.reduce((total, item) => total + item.actions.length, 0),
    },
    {
      id: "users",
      label: "Usuarios",
      status: sourceStatusByPermission(access, "users"),
      nodes: sourceStatusByPermission(access, "users") === "ok" ? users : 0,
      edges: 0,
    },
    {
      id: "companies",
      label: "Empresas",
      status: sourceStatusByPermission(access, "applications"),
      nodes: sourceStatusByPermission(access, "applications") === "ok" ? companies : 0,
      edges: 0,
    },
    {
      id: "projects",
      label: "Projetos",
      status: sourceStatusByPermission(access, "applications"),
      nodes: sourceStatusByPermission(access, "applications") === "ok" ? projects : 0,
      edges: 0,
    },
    {
      id: "audit",
      label: "Auditoria Brain",
      status: sourceStatusByPermission(access, "audit"),
      nodes: sourceStatusByPermission(access, "audit") === "ok" ? auditEvents : 0,
      edges: 0,
    },
  ];

  const [qase, jira] = await Promise.all([
    access
      ? safeSource(qaseBrainSource.healthCheck({ access, companySlug }), { id: "qase", label: "Qase/Kase" })
      : Promise.resolve({ id: "qase", label: "Qase/Kase", status: "disabled" as const, nodes: 0, edges: 0, message: "Sem contexto autenticado." }),
    access
      ? safeSource(jiraBrainSource.healthCheck({ access, companySlug }), { id: "jira", label: "Jira" })
      : Promise.resolve({ id: "jira", label: "Jira", status: "disabled" as const, nodes: 0, edges: 0, message: "Sem contexto autenticado." }),
  ]);

  const sources = [...staticSources, qase, jira];
  const ok = sources.every((source) => source.status !== "error");

  return {
    ok,
    nodes,
    edges,
    memories,
    sources,
    generatedAt: new Date().toISOString(),
  };
}

