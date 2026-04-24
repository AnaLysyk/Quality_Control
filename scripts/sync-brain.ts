import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prismaClient'
import type { Prisma } from '@prisma/client'
import {
  upsertNode,
  connectNodes,
  validateBrainIntegrity,
} from '@/lib/brain'

const log = (msg: string) => console.log(`[SYNC] ${msg}`)
const logError = (msg: string, error?: any) =>
  console.error(`[SYNC ERROR] ${msg}`, error?.message || '')

/**
 * Retorna o nó do Brain para uma entidade (por refType + refId)
 */
async function findNode(refType: string, refId: string) {
  return prisma.brainNode.findFirst({ where: { refType, refId } })
}

/**
 * Cria aresta entre dois nós por refType/refId (idempotente)
 */
async function safeConnect(
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
    await connectNodes(from.id, to.id, edgeType, meta).catch(() => {/* already exists */})
  }
}

type SystemRouteKind = 'page' | 'api'

type SystemRouteEntry = {
  refId: string
  kind: SystemRouteKind
  routePath: string
  filePath: string
  label: string
  description: string
  moduleRefId: string
  moduleLabel: string
  moduleDescription: string
  submoduleRefId: string | null
  submoduleLabel: string | null
  submoduleDescription: string | null
}

const APP_DIR = path.join(process.cwd(), 'app')

const SYSTEM_MODULE_LABELS: Record<string, string> = {
  home: 'Plataforma',
  api: 'APIs',
  admin: 'Administracao',
  automacoes: 'Automacoes',
  empresas: 'Empresas',
  dashboard: 'Dashboard',
  docs: 'Documentacao',
  applications: 'Aplicacoes',
  'applications-hub': 'Aplicacoes',
  'applications-panel': 'Aplicacoes',
  clients: 'Clientes',
  profile: 'Perfil',
  settings: 'Configuracoes',
  login: 'Acesso',
  requests: 'Solicitacoes',
  metrics: 'Metricas',
  runs: 'Runs',
  release: 'Releases',
  chamados: 'Chamados',
  chat: 'Chat',
  documentos: 'Documentos',
  issues: 'Issues',
}

function toPosix(value: string) {
  return value.split(path.sep).join('/')
}

function capitalizeWords(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function normalizeSegment(segment: string) {
  if (segment.startsWith('[') && segment.endsWith(']')) {
    return `:${segment.slice(1, -1)}`
  }

  return segment.replace(/[-_]/g, ' ')
}

function routeLabelFromPath(routePath: string, kind: SystemRouteKind) {
  if (routePath === '/') {
    return kind === 'api' ? 'Endpoint raiz da API' : 'Tela inicial da plataforma'
  }

  const humanPath = routePath
    .split('/')
    .filter(Boolean)
    .map((segment) => capitalizeWords(normalizeSegment(segment)))
    .join(' / ')

  return kind === 'api' ? `Endpoint ${humanPath}` : `Tela ${humanPath}`
}

function routeDescriptionFromFile(routePath: string, filePath: string, kind: SystemRouteKind) {
  if (kind === 'api') {
    return `Endpoint do sistema mapeado automaticamente a partir de ${filePath}. Rota: ${routePath}.`
  }

  return `Tela da plataforma mapeada automaticamente a partir de ${filePath}. Rota: ${routePath}.`
}

function buildRoutePath(relativeFilePath: string) {
  const parts = toPosix(relativeFilePath).split('/').filter(Boolean)
  const routeParts = parts
    .slice(0, -1)
    .filter((segment) => !segment.startsWith('('))
    .filter((segment) => !segment.startsWith('_'))

  if (routeParts.length === 0) return '/'
  return `/${routeParts.join('/')}`
}

function buildModuleLabel(segment: string) {
  return SYSTEM_MODULE_LABELS[segment] ?? capitalizeWords(normalizeSegment(segment))
}

function buildSystemRouteEntry(relativeFilePath: string): SystemRouteEntry | null {
  const normalized = toPosix(relativeFilePath)
  const isPage = normalized === 'page.tsx' || normalized.endsWith('/page.tsx')
  const isApiRoute = normalized.startsWith('api/') && normalized.endsWith('/route.ts')

  if (!isPage && !isApiRoute) return null

  const kind: SystemRouteKind = isApiRoute ? 'api' : 'page'
  const routePath = buildRoutePath(normalized)
  const routeSegments = routePath.split('/').filter(Boolean)
  const moduleSegment = kind === 'api' ? 'api' : routeSegments[0] ?? 'home'
  const submoduleSegment =
    kind === 'api'
      ? routeSegments[1] ?? null
      : routeSegments.length >= 2
        ? routeSegments[1]
        : null

  const moduleRefId = `${kind}:module:${moduleSegment}`
  const moduleLabel = buildModuleLabel(moduleSegment)
  const moduleDescription =
    kind === 'api'
      ? `Agrupa os endpoints da area ${moduleLabel.toLowerCase()} do sistema.`
      : `Agrupa telas e fluxos da area ${moduleLabel.toLowerCase()} da plataforma.`

  const submoduleRefId =
    submoduleSegment != null
      ? `${kind}:submodule:${moduleSegment}/${submoduleSegment}`
      : null
  const submoduleLabel =
    submoduleSegment != null
      ? `${moduleLabel} / ${buildModuleLabel(submoduleSegment)}`
      : null
  const submoduleDescription =
    submoduleLabel != null
      ? `Recorte funcional ${submoduleLabel.toLowerCase()} dentro do Brain.`
      : null

  return {
    refId: `${kind}:${routePath}`,
    kind,
    routePath,
    filePath: normalized,
    label: routeLabelFromPath(routePath, kind),
    description: routeDescriptionFromFile(routePath, normalized, kind),
    moduleRefId,
    moduleLabel,
    moduleDescription,
    submoduleRefId,
    submoduleLabel,
    submoduleDescription,
  }
}

async function collectRouteFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'node_modules') continue

    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(absolutePath, baseDir)))
      continue
    }

    if (entry.name !== 'page.tsx' && entry.name !== 'route.ts') continue
    files.push(path.relative(baseDir, absolutePath))
  }

  return files
}

async function collectSystemRoutes(): Promise<SystemRouteEntry[]> {
  const files = await collectRouteFiles(APP_DIR, APP_DIR)
  return files
    .map((filePath) => buildSystemRouteEntry(filePath))
    .filter((entry): entry is SystemRouteEntry => entry != null)
}

/**
 * Sincronização completa do Brain.
 * Cobre: Companies, Applications, Tickets, Defects, Users,
 *        Releases, ReleaseManuals, CompanyIntegrations, UserNotes, TestRuns
 */
export async function syncBrain() {
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

    // ── ReleaseManuals (releases manuais)
    const releaseManuals = await prisma.releaseManual.findMany()
    for (const rm of releaseManuals) {
      await upsertNode({
        type: 'Release',
        label: rm.title,
        refType: 'ReleaseManual',
        refId: rm.id,
        description: rm.description ?? undefined,
        metadata: {
          status: rm.status,
          companyId: rm.companyId,
          source: 'manual',
        },
      })
      nodeCount++
    }
    log(`Created ${releaseManuals.length} ReleaseManual nodes`)

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

    const systemRoutes = await collectSystemRoutes()
    const modules = new Map<
      string,
      { label: string; description: string; kind: SystemRouteKind }
    >()
    const submodules = new Map<
      string,
      { label: string; description: string; parentRefId: string; kind: SystemRouteKind }
    >()

    for (const entry of systemRoutes) {
      if (!modules.has(entry.moduleRefId)) {
        modules.set(entry.moduleRefId, {
          label: entry.moduleLabel,
          description: entry.moduleDescription,
          kind: entry.kind,
        })
      }

      if (entry.submoduleRefId && entry.submoduleLabel && entry.submoduleDescription) {
        submodules.set(entry.submoduleRefId, {
          label: entry.submoduleLabel,
          description: entry.submoduleDescription,
          parentRefId: entry.moduleRefId,
          kind: entry.kind,
        })
      }
    }

    for (const [refId, moduleEntry] of modules) {
      await upsertNode({
        type: 'Module',
        label: moduleEntry.label,
        refType: 'SystemModule',
        refId,
        description: moduleEntry.description,
        metadata: {
          source: 'app-router',
          kind: moduleEntry.kind,
        },
      })
      nodeCount++
    }
    log(`Created ${modules.size} system Module nodes`)

    for (const [refId, submoduleEntry] of submodules) {
      await upsertNode({
        type: 'Module',
        label: submoduleEntry.label,
        refType: 'SystemSubmodule',
        refId,
        description: submoduleEntry.description,
        metadata: {
          source: 'app-router',
          kind: submoduleEntry.kind,
          parentRefId: submoduleEntry.parentRefId,
        },
      })
      nodeCount++
    }
    log(`Created ${submodules.size} system submodule nodes`)

    for (const entry of systemRoutes) {
      await upsertNode({
        type: 'Screen',
        label: entry.label,
        refType: 'SystemScreen',
        refId: entry.refId,
        description: entry.description,
        metadata: {
          source: 'app-router',
          routePath: entry.routePath,
          routeKind: entry.kind,
          filePath: entry.filePath,
          moduleRefId: entry.moduleRefId,
          submoduleRefId: entry.submoduleRefId,
        },
      })
      nodeCount++
    }
    log(`Created ${systemRoutes.length} Screen nodes for pages and endpoints`)

    log(`✓ Total nodes created/updated: ${nodeCount}`)

    // ===== STEP 2: Edges
    log('Step 2: Creating edges between entities...')
    let edgeCount = 0

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

    // Company → Application (HAS_APPLICATION)
    for (const app of applications) {
      if (app.companyId) {
        await safeConnect('Application', app.id, 'Company', app.companyId, 'BELONGS_TO')
        edgeCount++
      }
    }

    // Company → Integration (HAS_INTEGRATION)
    for (const integration of integrations) {
      await safeConnect('Integration', integration.id, 'Company', integration.companyId, 'BELONGS_TO')
      edgeCount++
    }

    // Ticket → Company (BELONGS_TO)
    for (const ticket of tickets) {
      if (ticket.companyId) {
        await safeConnect('Ticket', ticket.id, 'Company', ticket.companyId, 'BELONGS_TO')
        edgeCount++
      }
      // Ticket → User (CREATED_BY)
      if (ticket.createdBy) {
        await safeConnect('Ticket', ticket.id, 'User', ticket.createdBy, 'CREATED_BY')
        edgeCount++
      }
      // Ticket → User (ASSIGNED_TO)
      if (ticket.assignedToUserId) {
        await safeConnect('Ticket', ticket.id, 'User', ticket.assignedToUserId, 'ASSIGNED_TO')
        edgeCount++
      }
    }

    // Defect → Company (BELONGS_TO)
    for (const defect of defects) {
      if (defect.companyId) {
        await safeConnect('Defect', defect.id, 'Company', defect.companyId, 'BELONGS_TO')
        edgeCount++
      }
    }

    // Release → Company (BELONGS_TO), Release → User (CREATED_BY / ASSIGNED_TO)
    for (const release of releases) {
      if (release.companyId) {
        await safeConnect('Release', release.id, 'Company', release.companyId, 'BELONGS_TO')
        edgeCount++
      }
      if (release.createdByUserId) {
        await safeConnect('Release', release.id, 'User', release.createdByUserId, 'CREATED_BY')
        edgeCount++
      }
      if (release.assignedToUserId) {
        await safeConnect('Release', release.id, 'User', release.assignedToUserId, 'ASSIGNED_TO')
        edgeCount++
      }
    }

    // ReleaseManual → Company (BELONGS_TO)
    for (const rm of releaseManuals) {
      await safeConnect('Release', rm.id, 'Company', rm.companyId, 'BELONGS_TO')
      edgeCount++
    }

    // User → Company (MEMBER_OF) via Membership
    const memberships = await prisma.membership.findMany()
    for (const membership of memberships) {
      await safeConnect('User', membership.userId, 'Company', membership.companyId, 'MEMBER_OF', {
        role: membership.role,
      })
      edgeCount++
    }

    // Note → User (CREATED_BY)
    for (const note of notes) {
      await safeConnect('Note', note.id, 'User', note.userId, 'CREATED_BY')
      edgeCount++
    }

    log(`✓ Total edges created: ${edgeCount}`)

    // ===== STEP 3: Validate
    log('Step 3: Validating integrity...')
    const validation = await validateBrainIntegrity()
    if (validation.valid) {
      log(`✓ Brain integrity: VALID`)
    } else {
      logError('Brain integrity issues', { errors: validation.errors })
    }
    log(`\nStats:\n  - Nodes: ${validation.stats.nodes}\n  - Edges: ${validation.stats.edges}\n  - Memories: ${validation.stats.memories}`)

    const duration = Date.now() - startTime
    log(`===== SYNC COMPLETED in ${duration}ms =====`)

    return {
      success: true,
      nodeCount,
      edgeCount,
      stats: validation.stats,
      duration,
    }
  } catch (error) {
    logError('SYNC FAILED', error)
    throw error
  }
}

// Executar script se chamado diretamente
if (require.main === module) {
  syncBrain()
    .then(result => {
      console.log('Final result:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}
