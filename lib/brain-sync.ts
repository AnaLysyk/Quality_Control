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
import type { Prisma } from "@prisma/client";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

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

/* ─── Company ─────────────────────────────────────────────────────────────── */

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

/* ─── CompanyIntegration ──────────────────────────────────────────────────── */

export async function syncIntegrationToBrain(integration: {
  id: string;
  companyId: string;
  type: string;
}): Promise<void> {
  try {
    const node = await upsertNode({
      type: "Integration",
      label: `${integration.type} Integration`,
      refType: "CompanyIntegration",
      refId: integration.id,
      description: `Integração ${integration.type}`,
      metadata: { integrationType: integration.type, companyId: integration.companyId },
    });
    await safeConnect("Integration", integration.id, "Company", integration.companyId, "BELONGS_TO");
    return void node;
  } catch (err) {
    console.error("[brain-sync] syncIntegrationToBrain error:", err);
  }
}

/* ─── Application ─────────────────────────────────────────────────────────── */

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

/* ─── User ────────────────────────────────────────────────────────────────── */

export async function syncUserToBrain(user: {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  job_title?: string | null;
}): Promise<void> {
  try {
    await upsertNode({
      type: "User",
      label: user.name,
      refType: "User",
      refId: user.id,
      metadata: {
        email: user.email ?? null,
        role: user.role ?? "user",
        jobTitle: user.job_title ?? null,
      },
    });
  } catch (err) {
    console.error("[brain-sync] syncUserToBrain error:", err);
  }
}

/* ─── Ticket ──────────────────────────────────────────────────────────────── */

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

/* ─── Defect ──────────────────────────────────────────────────────────────── */

export async function syncDefectToBrain(defect: {
  id: string;
  title?: string | null;
  description?: string | null;
  companyId?: string | null;
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
      },
    });
    if (defect.companyId) {
      await safeConnect("Defect", defect.id, "Company", defect.companyId, "BELONGS_TO");
    }
    if (defect.assignedToUserId) {
      await safeConnect("Defect", defect.id, "User", defect.assignedToUserId, "ASSIGNED_TO");
    }
  } catch (err) {
    console.error("[brain-sync] syncDefectToBrain error:", err);
  }
}

/* ─── Release ─────────────────────────────────────────────────────────────── */

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
      type: "Release",
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
      await safeConnect("Release", release.id, "Company", release.companyId, "BELONGS_TO");
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

/* ─── ReleaseManual ───────────────────────────────────────────────────────── */

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

/* ─── UserNote ────────────────────────────────────────────────────────────── */

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
      await safeConnect("Note", note.id, "User", note.userId, "CREATED_BY");
    }
  } catch (err) {
    console.error("[brain-sync] syncNoteToBrain error:", err);
  }
}

/* ─── Full Sync ───────────────────────────────────────────────────────────── */

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
    log('✓ Testing Company root node ready')

    // ===== STEP 1: Nodes
    log('Step 1: Creating nodes from entities...')
    let nodeCount = 0

    // ── Companies
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
        },
      })
      nodeCount++
    }
    log(`Created ${companies.length} Company nodes`)

    // ── Applications
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

    // ── Users
    const users = await prisma.user.findMany()
    for (const user of users) {
      await upsertNode({
        type: 'User',
        label: user.name,
        refType: 'User',
        refId: user.id,
        metadata: {
          email: user.email,
          role: user.role,
          jobTitle: user.job_title ?? null,
        },
      })
      nodeCount++
    }
    log(`Created ${users.length} User nodes`)

    // ── Tickets
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

    // ── Defects
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

    // ── Releases (Qase / Jira synced)
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
          environments: release.environments,
          source: release.source,
        },
      })
      nodeCount++
    }
    log(`Created ${releases.length} Release nodes`)

    // ── CompanyIntegrations
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
        },
      })
      nodeCount++
    }
    log(`Created ${integrations.length} Integration nodes`)

    // ── UserNotes
    const notes = await prisma.userNote.findMany({ take: 500 })
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

    // ── TestRuns
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

    log(`✓ Total nodes created/updated: ${nodeCount}`)

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
      await safeConnectNodes('Integration', integration.id, 'Company', integration.companyId, 'BELONGS_TO')
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
      await safeConnectNodes('Note', note.id, 'User', note.userId, 'CREATED_BY')
    }

    log(`✓ Total edges created: ${edgeCount}`)

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
