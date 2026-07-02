/**
 * brain-sync.ts
 * Fire-and-forget helper functions that keep the Brain in sync when system
 * entities are created or updated. Each function is safe to call without await
 * — they never throw, just log errors.
 *
 * Pattern in API routes:
 *   syncTicketToBrain(ticket).catch(() => {});
 */

import { prisma } from "@/lib/prismaClient";
import { upsertNode, connectNodes } from "@/lib/brain";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import type { Prisma } from "@prisma/client";

/* â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

async function findBrainNode(refType: string, refId: string) {
  return prisma.brainNode.findFirst({ where: { refType, refId } });
}

async function safeConnect(
  fromRefType: string,
  fromRefId: string,
  toRefType: string,
  toRefId: string,
  edgeType: string,
  meta?: Prisma.InputJsonValue,
) {
  const [from, to] = await Promise.all([
    findBrainNode(fromRefType, fromRefId),
    findBrainNode(toRefType, toRefId),
  ]);
  if (from && to) {
    await connectNodes(from.id, to.id, edgeType, meta);
  }
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

function jsonString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function jsonStringArray(value: Prisma.JsonValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().toUpperCase());
  }
  const single = jsonString(value);
  return single ? [single.toUpperCase()] : [];
}

function normalizeLinkKey(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function sanitizeIntegrationConfig(config: Prisma.JsonValue | null | undefined) {
  const record = jsonRecord(config);
  const projectCodes = [
    ...jsonStringArray(record.projects),
    ...jsonStringArray(record.projectCodes),
    ...jsonStringArray(record.project_codes),
    ...jsonStringArray(record.projectCode),
  ].filter((value, index, items) => items.indexOf(value) === index);

  return {
    projectCodes,
    baseUrl: jsonString(record.baseUrl) ?? jsonString(record.base_url),
    validationStatus: jsonString(record.validationStatus),
    isActive: record.isActive === true,
    isValid: record.isValid === true,
    hasToken: Boolean(
      jsonString(record.token) ??
      jsonString(record.apiToken) ??
      jsonString(record.api_token) ??
      jsonString(record.qaseToken) ??
      jsonString(record.qase_token),
    ),
  };
}

const ROLE_LABELS: Record<SystemRole, string> = {
  [SYSTEM_ROLES.EMPRESA]: "Administrador de empresa",
  [SYSTEM_ROLES.COMPANY_USER]: "Usuario de empresa",
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: "Usuario Testing Company",
  [SYSTEM_ROLES.LEADER_TC]: "Lider Testing Company",
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: "Suporte tecnico",
};

function resolveBrainProfileRole(input: {
  role?: string | null;
  globalRole?: string | null;
  isGlobalAdmin?: boolean | null;
}): SystemRole {
  if (input.isGlobalAdmin === true || String(input.globalRole ?? "").toLowerCase() === "global_admin") {
    return SYSTEM_ROLES.LEADER_TC;
  }

  return (
    normalizeLegacyRole(input.role ?? null) ??
    normalizeLegacyRole(input.globalRole ?? null) ??
    SYSTEM_ROLES.TESTING_COMPANY_USER
  );
}

async function ensureBrainPermissionProfiles() {
  for (const role of Object.values(SYSTEM_ROLES)) {
    await upsertNode({
      type: "Profile",
      label: ROLE_LABELS[role],
      refType: "PermissionProfile",
      refId: role,
      description: `Perfil RBAC ${ROLE_LABELS[role]} usado para resolver permissoes efetivas no Brain Graph.`,
      metadata: {
        source: "roleDefaults",
        roleKey: role,
        permissions: resolveRoleDefaults(role),
      },
    });
  }
}

/* â”€â”€â”€ Company â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncCompanyToBrain(company: {
  id: string;
  name: string;
  slug: string;
  status?: string | null;
  short_description?: string | null;
  integration_mode?: string | null;
  website?: string | null;
}): Promise<void> {
  try {
    await upsertNode({
      type: "Company",
      label: company.name,
      refType: "Company",
      refId: company.id,
      description: company.short_description ?? undefined,
      metadata: {
        slug: company.slug,
        status: company.status ?? "active",
        website: company.website ?? null,
        integrationMode: company.integration_mode ?? "manual",
      },
    });
  } catch (err) {
    console.error("[brain-sync] syncCompanyToBrain error:", err);
  }
}

/* â”€â”€â”€ CompanyIntegration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncIntegrationToBrain(integration: {
  id: string;
  companyId: string;
  type: string;
  config?: Prisma.JsonValue | null;
}): Promise<void> {
  try {
    const node = await upsertNode({
      type: "Integration",
      label: `${integration.type} Integration`,
      refType: "CompanyIntegration",
      refId: integration.id,
      description: `Integração ${integration.type}`,
      metadata: {
        integrationType: integration.type,
        companyId: integration.companyId,
        config: sanitizeIntegrationConfig(integration.config),
      },
    });
    await safeConnect("CompanyIntegration", integration.id, "Company", integration.companyId, "BELONGS_TO");
    return void node;
  } catch (err) {
    console.error("[brain-sync] syncIntegrationToBrain error:", err);
  }
}

/* â”€â”€â”€ Application â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncApplicationToBrain(app: {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  companyId?: string | null;
  active?: boolean | null;
  qaseProjectCode?: string | null;
  source?: string | null;
}): Promise<void> {
  try {
    await upsertNode({
      type: "Application",
      label: app.name,
      refType: "Application",
      refId: app.id,
      description: app.description ?? undefined,
      metadata: {
        slug: app.slug,
        companyId: app.companyId,
        active: app.active ?? true,
        qaseProjectCode: app.qaseProjectCode ?? null,
        source: app.source ?? "manual",
      },
    });
    if (app.companyId) {
      await safeConnect("Application", app.id, "Company", app.companyId, "BELONGS_TO");
    }
  } catch (err) {
    console.error("[brain-sync] syncApplicationToBrain error:", err);
  }
}

/* â”€â”€â”€ User â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncUserToBrain(user: {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  globalRole?: string | null;
  isGlobalAdmin?: boolean | null;
  job_title?: string | null;
}): Promise<void> {
  try {
    const profileRole = resolveBrainProfileRole({
      role: user.role,
      globalRole: user.globalRole,
      isGlobalAdmin: user.isGlobalAdmin,
    });
    await ensureBrainPermissionProfiles();
    await upsertNode({
      type: "User",
      label: user.name,
      refType: "User",
      refId: user.id,
      metadata: {
        email: user.email ?? null,
        role: user.role ?? "user",
        profileRole,
        globalRole: user.globalRole ?? null,
        jobTitle: user.job_title ?? null,
      },
    });
    await safeConnect("User", user.id, "PermissionProfile", profileRole, "HAS_PROFILE");
  } catch (err) {
    console.error("[brain-sync] syncUserToBrain error:", err);
  }
}

/* â”€â”€â”€ Ticket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncTicketToBrain(ticket: {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  type?: string | null;
  companyId?: string | null;
  createdBy?: string | null;
  assignedToUserId?: string | null;
}): Promise<void> {
  try {
    await upsertNode({
      type: "Ticket",
      label: ticket.title ?? `Ticket ${ticket.id.slice(0, 8)}`,
      refType: "Ticket",
      refId: ticket.id,
      description: ticket.description ?? undefined,
      metadata: {
        status: ticket.status ?? "backlog",
        priority: ticket.priority ?? "medium",
        ticketType: ticket.type ?? "tarefa",
        companyId: ticket.companyId ?? null,
      },
    });
    if (ticket.companyId) {
      await safeConnect("Ticket", ticket.id, "Company", ticket.companyId, "BELONGS_TO");
    }
    if (ticket.createdBy) {
      await safeConnect("Ticket", ticket.id, "User", ticket.createdBy, "CREATED_BY");
    }
    if (ticket.assignedToUserId) {
      await safeConnect("Ticket", ticket.id, "User", ticket.assignedToUserId, "ASSIGNED_TO");
    }
  } catch (err) {
    console.error("[brain-sync] syncTicketToBrain error:", err);
  }
}

/* â”€â”€â”€ Defect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncDefectToBrain(defect: {
  id: string;
  title?: string | null;
  description?: string | null;
  companyId?: string | null;
  releaseManualId?: string | null;
  status?: string | null;
  assignedToUserId?: string | null;
}): Promise<void> {
  try {
    await upsertNode({
      type: "Defect",
      label: defect.title ?? `Defect ${defect.id.slice(0, 8)}`,
      refType: "Defect",
      refId: defect.id,
      description: defect.description ?? undefined,
      metadata: {
        status: defect.status ?? "open",
        companyId: defect.companyId ?? null,
        releaseManualId: defect.releaseManualId ?? null,
      },
    });
    if (defect.companyId) {
      await safeConnect("Defect", defect.id, "Company", defect.companyId, "BELONGS_TO");
    }
    if (defect.assignedToUserId) {
      await safeConnect("Defect", defect.id, "User", defect.assignedToUserId, "ASSIGNED_TO");
    }
    if (defect.releaseManualId) {
      await safeConnect("Defect", defect.id, "ReleaseManual", defect.releaseManualId, "FOUND_IN_RELEASE");
    }
  } catch (err) {
    console.error("[brain-sync] syncDefectToBrain error:", err);
  }
}

/* â”€â”€â”€ Release â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncReleaseToBrain(release: {
  id: string;
  title?: string | null;
  slug?: string | null;
  summary?: string | null;
  status?: string | null;
  companyId?: string | null;
  createdByUserId?: string | null;
  assignedToUserId?: string | null;
  statsPass?: number | null;
  statsFail?: number | null;
  statsBlocked?: number | null;
  environments?: string[];
}): Promise<void> {
  try {
    await upsertNode({
      type: "ReleaseManual",
      label: release.title ?? release.slug ?? `Release ${release.id.slice(0, 8)}`,
      refType: "Release",
      refId: release.id,
      description: release.summary ?? undefined,
      metadata: {
        slug: release.slug,
        status: release.status ?? "DRAFT",
        companyId: release.companyId ?? null,
        statsPass: release.statsPass ?? 0,
        statsFail: release.statsFail ?? 0,
        statsBlocked: release.statsBlocked ?? 0,
        environments: release.environments ?? [],
      },
    });
    if (release.companyId) {
      await safeConnect("ReleaseManual", release.id, "Company", release.companyId, "BELONGS_TO");
    }
    if (release.createdByUserId) {
      await safeConnect("Release", release.id, "User", release.createdByUserId, "CREATED_BY");
    }
    if (release.assignedToUserId) {
      await safeConnect("Release", release.id, "User", release.assignedToUserId, "ASSIGNED_TO");
    }
  } catch (err) {
    console.error("[brain-sync] syncReleaseToBrain error:", err);
  }
}

/* â”€â”€â”€ ReleaseManual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncReleaseManualToBrain(release: {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  companyId?: string | null;
}): Promise<void> {
  try {
    await upsertNode({
      type: "Release",
      label: release.title ?? `Release Manual ${release.id.slice(0, 8)}`,
      refType: "ReleaseManual",
      refId: release.id,
      description: release.description ?? undefined,
      metadata: {
        status: release.status ?? "draft",
        companyId: release.companyId ?? null,
        source: "manual",
      },
    });
    if (release.companyId) {
      await safeConnect("Release", release.id, "Company", release.companyId, "BELONGS_TO");
    }
  } catch (err) {
    console.error("[brain-sync] syncReleaseManualToBrain error:", err);
  }
}

/* â”€â”€â”€ UserNote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncNoteToBrain(note: {
  id: string;
  title?: string | null;
  content?: string | null;
  userId?: string | null;
  status?: string | null;
  priority?: string | null;
  tags?: string[];
}): Promise<void> {
  try {
    await upsertNode({
      type: "Note",
      label: note.title ?? `Nota ${note.id.slice(0, 8)}`,
      refType: "UserNote",
      refId: note.id,
      description: note.content?.slice(0, 200) ?? undefined,
      metadata: {
        status: note.status ?? "Rascunho",
        priority: note.priority ?? "Baixa",
        tags: note.tags ?? [],
        userId: note.userId ?? null,
      },
    });
    if (note.userId) {
      await safeConnect("UserNote", note.id, "User", note.userId, "CREATED_BY");
    }
  } catch (err) {
    console.error("[brain-sync] syncNoteToBrain error:", err);
  }
}

/* â”€â”€â”€ Full Sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function syncBrain() {
  const log = (msg: string) => console.log(`[SYNC] ${msg}`)
  const logError = (msg: string, error?: any) =>
    console.error(`[SYNC ERROR] ${msg}`, error?.message || '')

  log('===== STARTING BRAIN SYNC — Testing Company Platform =====')
  const startTime = Date.now()

  try {
    log('Step 0: Ensuring Testing Company root node...')
    await upsertNode({
      type: 'Company',
      label: 'Testing Company',
      refType: 'Platform',
      refId: 'testing-company-root',
      description: 'Plataforma de QA da Testing Company — nó raiz do Brain',
      metadata: {
        slug: 'testing-company',
        status: 'active',
        website: 'https://testingcompany.com.br',
        integrationMode: 'platform',
        identity: 'root',
      },
    })
    log('âœ“ Testing Company root node ready')

    // ===== STEP 1: Nodes
    log('Step 1: Creating nodes from entities...')
    let nodeCount = 0

    // â”€â”€ Companies
    const companies = await prisma.company.findMany()
    for (const company of companies) {
      await upsertNode({
        type: 'Company',
        label: company.name,
        refType: 'Company',
        refId: company.id,
        description: company.short_description ?? undefined,
        metadata: {
          slug: company.slug,
          status: company.status,
          website: company.website ?? null,
          integrationMode: company.integration_mode ?? 'manual',
          qaseProjectCodes: company.qase_project_codes,
          hasQaseToken: Boolean(company.qase_token),
          legacyQaseProjectCode: company.qase_project_code ?? null,
        },
      })
      nodeCount++
    }
    log(`Created ${companies.length} Company nodes`)

    // â”€â”€ Applications
    const applications = await prisma.application.findMany()
    for (const app of applications) {
      await upsertNode({
        type: 'Application',
        label: app.name,
        refType: 'Application',
        refId: app.id,
        description: app.description ?? undefined,
        metadata: {
          slug: app.slug,
          companyId: app.companyId,
          active: app.active,
          qaseProjectCode: app.qaseProjectCode ?? null,
          source: app.source ?? 'manual',
        },
      })
      nodeCount++
    }
    log(`Created ${applications.length} Application nodes`)

    // â”€â”€ Users
    await ensureBrainPermissionProfiles()
    nodeCount += Object.values(SYSTEM_ROLES).length
    log(`Created ${Object.values(SYSTEM_ROLES).length} permission profile nodes`)

    const users = await prisma.user.findMany()
    for (const user of users) {
      const profileRole = resolveBrainProfileRole({
        role: user.role,
        globalRole: user.globalRole,
        isGlobalAdmin: user.is_global_admin,
      })
      await upsertNode({
        type: 'User',
        label: user.name,
        refType: 'User',
        refId: user.id,
        metadata: {
          email: user.email,
          role: user.role,
          profileRole,
          status: user.status,
          active: user.active,
          isGlobalAdmin: user.is_global_admin,
          globalRole: user.globalRole ?? null,
          defaultCompanySlug: user.default_company_slug ?? null,
          userOrigin: user.user_origin,
          jobTitle: user.job_title ?? null,
        },
      })
      nodeCount++
    }
    log(`Created ${users.length} User nodes`)

    // â”€â”€ Tickets
    const tickets = await prisma.ticket.findMany()
    for (const ticket of tickets) {
      await upsertNode({
        type: 'Ticket',
        label: ticket.title,
        refType: 'Ticket',
        refId: ticket.id,
        description: ticket.description ?? undefined,
        metadata: {
          status: ticket.status,
          priority: ticket.priority,
          ticketType: ticket.type,
          companyId: ticket.companyId,
        },
      })
      nodeCount++
    }
    log(`Created ${tickets.length} Ticket nodes`)

    // â”€â”€ Defects
    const defects = await prisma.defect.findMany()
    for (const defect of defects) {
      await upsertNode({
        type: 'Defect',
        label: defect.title,
        refType: 'Defect',
        refId: defect.id,
        description: defect.description ?? undefined,
        metadata: {
          companyId: defect.companyId,
        },
      })
      nodeCount++
    }
    log(`Created ${defects.length} Defect nodes`)

    // â”€â”€ Releases (Qase / Jira synced)
    const releases = await prisma.release.findMany()
    for (const release of releases) {
      await upsertNode({
        type: 'Release',
        label: release.title,
        refType: 'Release',
        refId: release.id,
        description: release.summary ?? undefined,
        metadata: {
          slug: release.slug,
          status: release.status,
          companyId: release.companyId ?? null,
          statsPass: release.statsPass,
          statsFail: release.statsFail,
          statsBlocked: release.statsBlocked,
          statsNotRun: release.statsNotRun,
          environments: release.environments,
          source: release.source,
          qaseProject: release.qaseProject ?? null,
          app: release.app ?? null,
          project: release.project ?? null,
          runId: release.runId ?? null,
          runSlug: release.runSlug ?? null,
          kind: release.kind ?? null,
        },
      })
      nodeCount++
    }
    log(`Created ${releases.length} Release nodes`)

    // â”€â”€ CompanyIntegrations
    const integrations = await prisma.companyIntegration.findMany()
    for (const integration of integrations) {
      await upsertNode({
        type: 'Integration',
        label: `${integration.type} Integration`,
        refType: 'CompanyIntegration',
        refId: integration.id,
        description: `Integração ${integration.type}`,
        metadata: {
          integrationType: integration.type,
          companyId: integration.companyId,
          config: sanitizeIntegrationConfig(integration.config),
        },
      })
      nodeCount++
    }
    log(`Created ${integrations.length} Integration nodes`)

    // â”€â”€ UserNotes
    const notes = await prisma.userNote.findMany({ take: 500 })
    for (const role of Object.values(SYSTEM_ROLES)) {
      const matrix = resolveRoleDefaults(role)
      for (const [moduleId, actions] of Object.entries(matrix)) {
        if (!actions.length) continue
        await safeConnectNodes('PermissionProfile', role, 'PermissionModule', moduleId, 'GRANTS_MODULE_ACCESS', {
          role,
          actions,
        })
        for (const action of actions) {
          await safeConnectNodes('PermissionProfile', role, 'PermissionAction', `${moduleId}:${action}`, 'GRANTS_ACTION', {
            role,
            moduleId,
            action,
          })
        }
      }
    }

    for (const user of users) {
      const profileRole = resolveBrainProfileRole({
        role: user.role,
        globalRole: user.globalRole,
        isGlobalAdmin: user.is_global_admin,
      })
      await safeConnectNodes('User', user.id, 'PermissionProfile', profileRole, 'HAS_PROFILE', {
        role: user.role,
        profileRole,
        globalRole: user.globalRole ?? null,
        isGlobalAdmin: user.is_global_admin,
      })
    }

    for (const note of notes) {
      await upsertNode({
        type: 'Note',
        label: note.title,
        refType: 'UserNote',
        refId: note.id,
        description: note.content.slice(0, 200),
        metadata: {
          status: note.status,
          priority: note.priority,
          tags: note.tags,
          userId: note.userId,
        },
      })
      nodeCount++
    }
    log(`Created ${notes.length} Note nodes`)

    // â”€â”€ TestRuns
    const testRuns = await prisma.testRun.findMany({ take: 200 })
    for (const run of testRuns) {
      await upsertNode({
        type: 'TestRun',
        label: `TestRun ${run.id.slice(0, 8)}`,
        refType: 'TestRun',
        refId: run.id,
        metadata: { status: run.status },
      })
      nodeCount++
    }
    log(`Created ${testRuns.length} TestRun nodes`)

    // â”€â”€ Release manuals
    const releaseManuals = await prisma.releaseManual.findMany({ take: 500 })
    for (const releaseManual of releaseManuals) {
      await upsertNode({
        type: 'ReleaseManual',
        label: releaseManual.title,
        refType: 'ReleaseManual',
        refId: releaseManual.id,
        description: releaseManual.description ?? undefined,
        metadata: {
          status: releaseManual.status,
          companyId: releaseManual.companyId,
          source: 'manual',
          updatedAt: releaseManual.updatedAt.toISOString(),
        },
      })
      nodeCount++
    }
    log(`Created ${releaseManuals.length} ReleaseManual nodes`)

    // â”€â”€ Release cases
    const releaseCases = await prisma.releaseCase.findMany({ take: 1000 })
    for (const releaseCase of releaseCases) {
      await upsertNode({
        type: 'ReleaseCase',
        label: releaseCase.title ?? `Caso ${releaseCase.id.slice(0, 8)}`,
        refType: 'ReleaseCase',
        refId: releaseCase.id,
        description: releaseCase.bug ?? releaseCase.link ?? undefined,
        metadata: {
          releaseId: releaseCase.releaseId,
          status: releaseCase.status,
          bug: releaseCase.bug ?? null,
          link: releaseCase.link ?? null,
          fromApi: releaseCase.fromApi,
        },
      })
      nodeCount++
    }
    log(`Created ${releaseCases.length} ReleaseCase nodes`)

    // â”€â”€ Manual test plans
    const manualTestPlans = await prisma.manualTestPlan.findMany({ take: 500 })
    for (const plan of manualTestPlans) {
      await upsertNode({
        type: 'TestPlan',
        label: plan.title,
        refType: 'ManualTestPlan',
        refId: plan.id,
        description: plan.description ?? undefined,
        metadata: {
          companySlug: plan.companySlug,
          applicationId: plan.applicationId,
          applicationName: plan.applicationName,
          applicationSlug: plan.applicationSlug,
          projectCode: plan.projectCode ?? null,
          source: 'manual',
          updatedAt: plan.updatedAt.toISOString(),
        },
      })
      nodeCount++
    }
    log(`Created ${manualTestPlans.length} ManualTestPlan nodes`)

    // â”€â”€ Quality alerts
    const qualityAlerts = await prisma.qualityAlert.findMany({ take: 500, orderBy: { timestamp: 'desc' } })
    for (const alert of qualityAlerts) {
      await upsertNode({
        type: 'QualityAlert',
        label: `${alert.severity}: ${alert.message.slice(0, 80)}`,
        refType: 'QualityAlert',
        refId: alert.id,
        description: alert.message,
        metadata: {
          companySlug: alert.companySlug,
          alertType: alert.type,
          severity: alert.severity,
          timestamp: alert.timestamp.toISOString(),
        },
      })
      nodeCount++
    }
    log(`Created ${qualityAlerts.length} QualityAlert nodes`)

    log('Step 1.5: Creating system map nodes from code...')
    const { syncSystemMapToBrain } = await import("@/lib/brain-system-map")
    const systemMap = await syncSystemMapToBrain()
    nodeCount += systemMap.nodeCount
    log(`Created ${systemMap.nodeCount} system/code nodes`)

    log(`âœ“ Total nodes created/updated: ${nodeCount}`)

    // ===== STEP 2: Edges
    log('Step 2: Creating edges between entities...')
    let edgeCount = 0

    async function findNode(refType: string, refId: string) {
      return prisma.brainNode.findFirst({ where: { refType, refId } })
    }

    async function safeConnectNodes(
      fromRefType: string, fromRefId: string,
      toRefType: string, toRefId: string,
      edgeType: string,
      meta?: Prisma.InputJsonValue,
    ) {
      const [from, to] = await Promise.all([
        findNode(fromRefType, fromRefId),
        findNode(toRefType, toRefId),
      ])
      if (from && to) {
        await connectNodes(from.id, to.id, edgeType, meta).catch(() => {})
        edgeCount++
      }
    }

    // Testing Company root → all Companies (RELATES_TO)
    const rootNode = await findNode('Platform', 'testing-company-root')
    if (rootNode) {
      for (const company of companies) {
        const cn = await findNode('Company', company.id)
        if (cn) {
          await connectNodes(rootNode.id, cn.id, 'RELATES_TO').catch(() => {})
          edgeCount++
        }
      }
    }

    // Company → Application (BELONGS_TO)
    for (const app of applications) {
      if (app.companyId) {
        await safeConnectNodes('Application', app.id, 'Company', app.companyId, 'BELONGS_TO')
      }
    }

    // Company → Integration (BELONGS_TO)
    for (const integration of integrations) {
      await safeConnectNodes('CompanyIntegration', integration.id, 'Company', integration.companyId, 'BELONGS_TO')
      if (integration.type === 'QASE') {
        const projectCodes = new Set(sanitizeIntegrationConfig(integration.config).projectCodes.map(normalizeLinkKey))
        for (const app of applications) {
          const appProject = normalizeLinkKey(app.qaseProjectCode)
          if (app.companyId === integration.companyId && appProject && projectCodes.has(appProject)) {
            await safeConnectNodes('CompanyIntegration', integration.id, 'Application', app.id, 'INTEGRATES_WITH', {
              provider: 'QASE',
              projectCode: app.qaseProjectCode ?? null,
            })
          }
        }
      }
    }

    // Ticket → Company (BELONGS_TO)
    for (const ticket of tickets) {
      if (ticket.companyId) {
        await safeConnectNodes('Ticket', ticket.id, 'Company', ticket.companyId, 'BELONGS_TO')
      }
      // Ticket → User (CREATED_BY)
      if (ticket.createdBy) {
        await safeConnectNodes('Ticket', ticket.id, 'User', ticket.createdBy, 'CREATED_BY')
      }
      // Ticket → User (ASSIGNED_TO)
      if (ticket.assignedToUserId) {
        await safeConnectNodes('Ticket', ticket.id, 'User', ticket.assignedToUserId, 'ASSIGNED_TO')
      }
    }

    // Defect → Company (BELONGS_TO)
    for (const defect of defects) {
      if (defect.companyId) {
        await safeConnectNodes('Defect', defect.id, 'Company', defect.companyId, 'BELONGS_TO')
      }
      if (defect.releaseManualId) {
        await safeConnectNodes('Defect', defect.id, 'ReleaseManual', defect.releaseManualId, 'FOUND_IN_RELEASE')
      }
    }

    // Release → Company (BELONGS_TO), Release → User (CREATED_BY / ASSIGNED_TO)
    for (const release of releases) {
      if (release.companyId) {
        await safeConnectNodes('Release', release.id, 'Company', release.companyId, 'BELONGS_TO')
      }
      if (release.createdByUserId) {
        await safeConnectNodes('Release', release.id, 'User', release.createdByUserId, 'CREATED_BY')
      }
      if (release.assignedToUserId) {
        await safeConnectNodes('Release', release.id, 'User', release.assignedToUserId, 'ASSIGNED_TO')
      }
      const releaseProject = normalizeLinkKey(release.qaseProject ?? release.project ?? release.app)
      if (releaseProject) {
        const app = applications.find((item) =>
          normalizeLinkKey(item.qaseProjectCode) === releaseProject ||
          normalizeLinkKey(item.slug) === releaseProject ||
          normalizeLinkKey(item.name) === releaseProject
        )
        if (app) await safeConnectNodes('Release', release.id, 'Application', app.id, 'TESTS_APPLICATION')
      }
    }

    for (const releaseManual of releaseManuals) {
      await safeConnectNodes('ReleaseManual', releaseManual.id, 'Company', releaseManual.companyId, 'BELONGS_TO')
    }

    for (const releaseCase of releaseCases) {
      await safeConnectNodes('ReleaseCase', releaseCase.id, 'Release', releaseCase.releaseId, 'BELONGS_TO')
    }

    for (const plan of manualTestPlans) {
      await safeConnectNodes('ManualTestPlan', plan.id, 'Application', plan.applicationId, 'COVERS_APPLICATION')
      const company = companies.find((item) => item.slug === plan.companySlug)
      if (company) await safeConnectNodes('ManualTestPlan', plan.id, 'Company', company.id, 'BELONGS_TO')
    }

    for (const alert of qualityAlerts) {
      const company = companies.find((item) => item.slug === alert.companySlug)
      if (company) await safeConnectNodes('QualityAlert', alert.id, 'Company', company.id, 'BELONGS_TO')
    }

    // User → Company (MEMBER_OF) via Membership
    const memberships = await prisma.membership.findMany()
    for (const membership of memberships) {
      await safeConnectNodes('User', membership.userId, 'Company', membership.companyId, 'MEMBER_OF', {
        role: membership.role,
      })
    }

    // Note → User (CREATED_BY)
    for (const note of notes) {
      await safeConnectNodes('UserNote', note.id, 'User', note.userId, 'CREATED_BY')
    }

    log(`Created ${edgeCount} entity relationship edges`)

    for (const company of companies) await safeConnectNodes('Company', company.id, 'PrismaModel', 'Company', 'INSTANCE_OF')
    for (const app of applications) await safeConnectNodes('Application', app.id, 'PrismaModel', 'Application', 'INSTANCE_OF')
    for (const user of users) await safeConnectNodes('User', user.id, 'PrismaModel', 'User', 'INSTANCE_OF')
    for (const ticket of tickets) await safeConnectNodes('Ticket', ticket.id, 'PrismaModel', 'Ticket', 'INSTANCE_OF')
    for (const defect of defects) await safeConnectNodes('Defect', defect.id, 'PrismaModel', 'Defect', 'INSTANCE_OF')
    for (const release of releases) await safeConnectNodes('Release', release.id, 'PrismaModel', 'Release', 'INSTANCE_OF')
    for (const integration of integrations) await safeConnectNodes('CompanyIntegration', integration.id, 'PrismaModel', 'CompanyIntegration', 'INSTANCE_OF')
    for (const note of notes) await safeConnectNodes('UserNote', note.id, 'PrismaModel', 'UserNote', 'INSTANCE_OF')
    for (const run of testRuns) await safeConnectNodes('TestRun', run.id, 'PrismaModel', 'TestRun', 'INSTANCE_OF')
    for (const releaseManual of releaseManuals) await safeConnectNodes('ReleaseManual', releaseManual.id, 'PrismaModel', 'ReleaseManual', 'INSTANCE_OF')
    for (const releaseCase of releaseCases) await safeConnectNodes('ReleaseCase', releaseCase.id, 'PrismaModel', 'ReleaseCase', 'INSTANCE_OF')
    for (const plan of manualTestPlans) await safeConnectNodes('ManualTestPlan', plan.id, 'PrismaModel', 'ManualTestPlan', 'INSTANCE_OF')
    for (const alert of qualityAlerts) await safeConnectNodes('QualityAlert', alert.id, 'PrismaModel', 'QualityAlert', 'INSTANCE_OF')

    edgeCount += systemMap.edgeCount
    log(`Created ${systemMap.edgeCount} system/code edges`)
    log(`Total edges including system/code: ${edgeCount}`)

    const duration = Date.now() - startTime
    log(`===== SYNC COMPLETED in ${duration}ms =====`)

    return {
      success: true,
      nodeCount,
      edgeCount,
      duration,
    }
  } catch (error) {
    logError('SYNC FAILED', error)
    throw error
  }
}

