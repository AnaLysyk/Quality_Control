import type { BrainNode, Prisma } from '@prisma/client'
import dotenv from 'dotenv'

const log = (msg: string) => console.log(`[SYNC] ${msg}`)
const logError = (msg: string, error?: unknown) =>
  console.error(`[SYNC ERROR] ${msg}`, error instanceof Error ? error.message : '')

type BrainModule = typeof import('@/lib/brain')
type NodeInput = Parameters<BrainModule['upsertNode']>[0]
type CompanyScope = { companyId: string | null; companySlug: string | null }
type BrainSyncDeps = {
  prisma: typeof import('@/lib/prismaClient')['prisma']
  upsertNode: BrainModule['upsertNode']
  connectNodes: BrainModule['connectNodes']
  validateBrainIntegrity: BrainModule['validateBrainIntegrity']
}

const SAFE_SOURCE = 'brain_sync'

let dependencies: BrainSyncDeps | null = null

function loadLocalEnv() {
  dotenv.config({ path: '.env.local', override: false })
  dotenv.config({ path: '.env', override: false })
}

async function loadDependencies(): Promise<BrainSyncDeps> {
  if (dependencies) return dependencies
  loadLocalEnv()

  const prismaModule = await import('@/lib/prismaClient')
  const brainModule = await import('@/lib/brain')

  dependencies = {
    prisma: prismaModule.prisma,
    upsertNode: brainModule.upsertNode,
    connectNodes: brainModule.connectNodes,
    validateBrainIntegrity: brainModule.validateBrainIntegrity,
  }
  return dependencies
}

function text(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function boolStatus(value: boolean | null | undefined) {
  return value === false ? 'inactive' : 'active'
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return text(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => text(item)).filter((item): item is string => Boolean(item))))
}

function maskEmail(value: unknown) {
  const email = text(value)
  if (!email) return null
  const [name, domain] = email.split('@')
  if (!name || !domain) return null
  return `${name.slice(0, 2)}***@${domain}`
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    return value
      .map((item) => toJsonValue(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined) as Prisma.InputJsonArray
  }
  if (typeof value === 'object') {
    const output: Record<string, Prisma.InputJsonValue> = {}
    for (const [key, item] of Object.entries(value)) {
      const safeValue = toJsonValue(item)
      if (safeValue !== undefined) output[key] = safeValue
    }
    return output as Prisma.InputJsonObject
  }
  return String(value)
}

function metadata(input: Record<string, unknown>): Prisma.InputJsonValue {
  return toJsonValue({
    ...input,
    source: input.source ?? SAFE_SOURCE,
    createdBy: input.createdBy ?? 'system',
  }) ?? {}
}

function refKey(refType: string, refId: string) {
  return `${refType}:${refId}`
}

function testCaseRecord(row: { id: string; data: Prisma.JsonValue }) {
  const record = asRecord(row.data)
  const testCase = asRecord(record.testCase)
  return { record, testCase }
}

function testCaseLabel(row: { id: string; data: Prisma.JsonValue }) {
  const { testCase } = testCaseRecord(row)
  return (
    text(testCase.title) ??
    text(testCase.key) ??
    text(testCase.externalKey) ??
    `Caso de teste ${row.id.slice(0, 8)}`
  )
}

function testCaseDescription(row: { data: Prisma.JsonValue }) {
  const { testCase } = testCaseRecord({ id: '', data: row.data })
  return text(testCase.description) ?? text(testCase.objective) ?? undefined
}

async function upsertSyncedNode(
  deps: BrainSyncDeps,
  nodesByRef: Map<string, BrainNode>,
  input: NodeInput,
) {
  const node = await deps.upsertNode(input)
  if (input.refType && input.refId) {
    nodesByRef.set(refKey(input.refType, input.refId), node)
  }
  return node
}

async function connectByRef(
  deps: BrainSyncDeps,
  nodesByRef: Map<string, BrainNode>,
  fromRefType: string,
  fromRefId: string | null | undefined,
  toRefType: string,
  toRefId: string | null | undefined,
  edgeType: string,
  meta: Record<string, unknown> = {},
) {
  const fromId = text(fromRefId)
  const toId = text(toRefId)
  if (!fromId || !toId) return false

  const from = nodesByRef.get(refKey(fromRefType, fromId))
  const to = nodesByRef.get(refKey(toRefType, toId))
  if (!from || !to) return false

  await deps.connectNodes(from.id, to.id, edgeType, metadata({
    ...meta,
    reason: meta.reason ?? `${fromRefType}_${edgeType}_${toRefType}`,
  }))
  return true
}

/**
 * Sincronizacao idempotente do Brain.
 * Nunca apaga BrainNode, BrainEdge nem BrainMemory.
 */
export async function syncBrain() {
  log('===== STARTING BRAIN SYNC =====')
  const startTime = Date.now()

  try {
    const deps = await loadDependencies()
    const { prisma, validateBrainIntegrity } = deps

    log('Step 1: Reading operational entities...')
    const [
      companies,
      applications,
      tickets,
      defects,
      users,
      memberships,
      projects,
      companyDocuments,
      wikiCategories,
      wikiDocs,
      storedTestCases,
      testPlans,
      testPlanItems,
      manualTestPlans,
      testRuns,
      testRunResults,
    ] = await Promise.all([
      prisma.company.findMany(),
      prisma.application.findMany(),
      prisma.ticket.findMany(),
      prisma.defect.findMany(),
      prisma.user.findMany(),
      prisma.membership.findMany(),
      prisma.project.findMany(),
      prisma.companyDocument.findMany(),
      prisma.wikiCategory.findMany(),
      prisma.wikiDoc.findMany(),
      prisma.storedTestCase.findMany(),
      prisma.testPlan.findMany(),
      prisma.testPlanItem.findMany(),
      prisma.manualTestPlan.findMany(),
      prisma.testRun.findMany(),
      prisma.testRunResult.findMany(),
    ])

    const companiesById = new Map(companies.map((company) => [company.id, company]))
    const companiesBySlug = new Map(companies.map((company) => [company.slug.toLowerCase(), company]))
    const projectsById = new Map(projects.map((project) => [project.id, project]))
    const testPlansById = new Map(testPlans.map((plan) => [plan.id, plan]))
    const testRunsById = new Map(testRuns.map((run) => [run.id, run]))
    const membershipsByUserId = new Map<string, typeof memberships>()
    for (const membership of memberships) {
      const userMemberships = membershipsByUserId.get(membership.userId) ?? []
      userMemberships.push(membership)
      membershipsByUserId.set(membership.userId, userMemberships)
    }

    function resolveCompanyScope(input: {
      companyId?: string | null
      companySlug?: string | null
      projectId?: string | null
    }): CompanyScope {
      let companyId = text(input.companyId)
      let companySlug = text(input.companySlug)?.toLowerCase() ?? null
      const project = input.projectId ? projectsById.get(input.projectId) : null

      if (project) companyId = companyId ?? project.companyId

      if (companyId && !companiesById.has(companyId)) {
        const company = companiesBySlug.get(companyId.toLowerCase())
        if (company) {
          companySlug = company.slug
          companyId = company.id
        }
      }

      if (companySlug && !companyId) {
        companyId = companiesBySlug.get(companySlug)?.id ?? null
      }

      if (companyId && !companySlug) {
        companySlug = companiesById.get(companyId)?.slug ?? null
      }

      return { companyId, companySlug }
    }

    const nodesByRef = new Map<string, BrainNode>()
    let nodeCount = 0
    let edgeCount = 0

    async function addNode(input: NodeInput) {
      await upsertSyncedNode(deps, nodesByRef, input)
      nodeCount++
    }

    async function addEdge(
      fromRefType: string,
      fromRefId: string | null | undefined,
      toRefType: string,
      toRefId: string | null | undefined,
      edgeType: string,
      meta: Record<string, unknown> = {},
    ) {
      if (await connectByRef(deps, nodesByRef, fromRefType, fromRefId, toRefType, toRefId, edgeType, meta)) {
        edgeCount++
      }
    }

    log('Step 2: Creating/updating Brain nodes...')

    for (const company of companies) {
      await addNode({
        type: 'Company',
        label: company.name,
        refType: 'Company',
        refId: company.id,
        description: company.short_description ?? undefined,
        metadata: metadata({
          companyId: company.id,
          companySlug: company.slug,
          slug: company.slug,
          status: company.status,
          active: company.active,
          createdAt: iso(company.createdAt),
          updatedAt: iso(company.updatedAt),
          sourceType: 'operational_company',
        }),
      })
    }
    log(`Created/updated ${companies.length} Company nodes`)

    for (const project of projects) {
      const scope = resolveCompanyScope({ companyId: project.companyId, projectId: project.id })
      await addNode({
        type: 'Project',
        label: project.name,
        refType: 'Project',
        refId: project.id,
        description: project.description ?? undefined,
        metadata: metadata({
          ...scope,
          projectId: project.id,
          projectSlug: project.slug,
          projectName: project.name,
          status: project.status,
          color: project.color ?? null,
          iconKey: project.iconKey ?? null,
          createdBy: project.createdById ?? 'system',
          createdAt: iso(project.createdAt),
          updatedAt: iso(project.updatedAt),
          archivedAt: iso(project.archivedAt),
          sourceType: 'operational_project',
        }),
      })
    }
    log(`Created/updated ${projects.length} Project nodes`)

    for (const app of applications) {
      const scope = resolveCompanyScope({ companyId: app.companyId, companySlug: app.companySlug })
      await addNode({
        type: 'Application',
        label: app.name,
        refType: 'Application',
        refId: app.id,
        description: app.description ?? undefined,
        metadata: metadata({
          ...scope,
          applicationId: app.id,
          applicationSlug: app.slug,
          status: boolStatus(app.active),
          active: app.active,
          qaseProjectCode: app.qaseProjectCode ?? null,
          createdAt: iso(app.createdAt),
          updatedAt: iso(app.updatedAt),
          sourceType: 'operational_application',
        }),
      })
    }
    log(`Created/updated ${applications.length} Application nodes`)

    for (const ticket of tickets) {
      const scope = resolveCompanyScope({ companyId: ticket.companyId, companySlug: ticket.companySlug })
      await addNode({
        type: 'Ticket',
        label: ticket.title,
        refType: 'Ticket',
        refId: ticket.id,
        description: ticket.description ?? undefined,
        metadata: metadata({
          ...scope,
          status: ticket.status,
          priority: ticket.priority,
          ticketType: ticket.type,
          tags: ticket.tags,
          createdBy: ticket.createdBy,
          createdByName: ticket.createdByName ?? null,
          assignedToUserId: ticket.assignedToUserId ?? null,
          createdAt: iso(ticket.createdAt),
          updatedAt: iso(ticket.updatedAt),
          sourceType: 'operational_ticket',
        }),
      })
    }
    log(`Created/updated ${tickets.length} Ticket nodes`)

    for (const defect of defects) {
      const scope = resolveCompanyScope({ companyId: defect.companyId })
      await addNode({
        type: 'Defect',
        label: defect.title,
        refType: 'Defect',
        refId: defect.id,
        description: defect.description ?? undefined,
        metadata: metadata({
          ...scope,
          status: 'open',
          releaseManualId: defect.releaseManualId ?? null,
          createdAt: iso(defect.createdAt),
          updatedAt: iso(defect.updatedAt),
          sourceType: 'operational_defect',
        }),
      })
    }
    log(`Created/updated ${defects.length} Defect nodes`)

    for (const user of users) {
      const userMemberships = membershipsByUserId.get(user.id) ?? []
      const companyIds = Array.from(new Set([
        ...userMemberships.map((membership) => membership.companyId),
        user.created_by_company_id,
        user.home_company_id,
      ].filter((companyId): companyId is string => Boolean(companyId))))
      const companySlugs = Array.from(new Set([
        ...companyIds.map((companyId) => companiesById.get(companyId)?.slug),
        user.default_company_slug,
      ].filter((companySlug): companySlug is string => Boolean(companySlug))))
      const userRoleLabels: Record<string, string> = {
        leader_tc: 'Líder TC',
        technical_support: 'Suporte técnico',
        company: 'Empresa',
        company_admin: 'Administrador da empresa',
        user: 'Usuário',
        viewer: 'Visualizador',
        admin: 'Administrador',
        it_dev: 'TI/Dev',
        dev: 'Desenvolvedor(a)',
        support: 'Suporte',
      }
      const userRoleLabel = userRoleLabels[String(user.role ?? '')] ?? 'Usuário'
      const userStatusLabel = user.active === false || user.status === 'blocked' ? 'inativo' : 'ativo'
      const userCompanyCount = companySlugs.length
      const userDescription = `${userRoleLabel} · ${userStatusLabel}${userCompanyCount ? ` · vinculado a ${userCompanyCount} empresa${userCompanyCount > 1 ? 's' : ''}` : ''}.`

      await addNode({
        type: 'User',
        label: user.name,
        refType: 'User',
        refId: user.id,
        description: userDescription,
        metadata: metadata({
          email: null,
          emailMasked: maskEmail(user.email),
          role: user.role,
          status: user.status,
          active: user.active,
          isGlobalAdmin: user.is_global_admin,
          companyIds,
          companySlugs,
          defaultCompanySlug: user.default_company_slug ?? null,
          createdByCompanyId: user.created_by_company_id ?? null,
          homeCompanyId: user.home_company_id ?? null,
          jobTitle: user.job_title ?? null,
          createdAt: iso(user.createdAt),
          updatedAt: iso(user.updatedAt),
          sourceType: 'operational_user',
        }),
      })
    }
    log(`Created/updated ${users.length} User nodes`)

    for (const document of companyDocuments) {
      const scope = resolveCompanyScope({ companySlug: document.companySlug })
      await addNode({
        type: 'CompanyDocument',
        label: document.title,
        refType: 'CompanyDocument',
        refId: document.id,
        description: document.description ?? undefined,
        metadata: metadata({
          ...scope,
          status: 'active',
          kind: document.kind,
          fileName: document.fileName ?? null,
          mimeType: document.mimeType ?? null,
          sizeBytes: document.sizeBytes ?? null,
          hasUrl: Boolean(document.url),
          hasFile: Boolean(document.storagePath),
          createdBy: document.createdBy ?? 'system',
          createdByName: document.createdByName ?? null,
          createdAt: iso(document.createdAt),
          sourceType: 'company_document',
          tags: ['documento', document.kind],
        }),
      })
    }
    log(`Created/updated ${companyDocuments.length} CompanyDocument nodes`)

    for (const category of wikiCategories) {
      const scope = resolveCompanyScope({ companySlug: category.companySlug })
      await addNode({
        type: 'WikiCategory',
        label: category.title,
        refType: 'WikiCategory',
        refId: category.id,
        description: category.description ?? undefined,
        metadata: metadata({
          ...scope,
          categorySlug: category.slug,
          status: 'active',
          icon: category.icon ?? null,
          order: category.order,
          createdBy: category.createdBy ?? 'system',
          createdAt: iso(category.createdAt),
          updatedAt: iso(category.updatedAt),
          sourceType: 'wiki_category',
          tags: ['wiki', 'categoria'],
        }),
      })
    }
    log(`Created/updated ${wikiCategories.length} WikiCategory nodes`)

    for (const doc of wikiDocs) {
      const category = wikiCategories.find((item) => item.id === doc.categoryId)
      const scope = resolveCompanyScope({ companySlug: doc.companySlug ?? category?.companySlug ?? null })
      await addNode({
        type: 'WikiDoc',
        label: doc.title,
        refType: 'WikiDoc',
        refId: doc.id,
        description: doc.description ?? undefined,
        metadata: metadata({
          ...scope,
          categoryId: doc.categoryId,
          docSlug: doc.slug,
          status: doc.status,
          order: doc.order,
          createdBy: doc.createdBy ?? 'system',
          updatedBy: doc.updatedBy ?? null,
          createdAt: iso(doc.createdAt),
          updatedAt: iso(doc.updatedAt),
          sourceType: 'wiki_doc',
          tags: ['wiki', 'documentacao'],
        }),
      })
    }
    log(`Created/updated ${wikiDocs.length} WikiDoc nodes`)

    for (const row of storedTestCases) {
      const { testCase } = testCaseRecord(row)
      const companyId = text(testCase.companyId) ?? row.companyId
      const projectId = text(testCase.projectId) ?? row.projectId
      const scope = resolveCompanyScope({ companyId, projectId })
      await addNode({
        type: 'StoredTestCase',
        label: testCaseLabel(row),
        refType: 'StoredTestCase',
        refId: row.id,
        description: testCaseDescription(row),
        metadata: metadata({
          ...scope,
          projectId,
          testCaseId: row.id,
          key: text(testCase.key),
          externalKey: text(testCase.externalKey),
          source: text(testCase.source) ?? SAFE_SOURCE,
          sourceType: 'stored_test_case',
          status: text(testCase.status) ?? (row.archivedAt ? 'archived' : 'active'),
          priority: text(testCase.priority),
          severity: text(testCase.severity),
          risk: text(testCase.risk),
          type: text(testCase.type),
          applicationId: text(testCase.applicationId),
          moduleId: text(testCase.moduleId),
          testProjectCode: text(testCase.testProjectCode),
          testProjectName: text(testCase.testProjectName),
          suiteId: text(testCase.suiteId),
          suiteName: text(testCase.suiteName),
          tags: stringList(testCase.tags),
          automationStatus: text(testCase.automationStatus),
          createdBy: text(testCase.createdBy) ?? 'system',
          updatedBy: text(testCase.updatedBy),
          createdAt: text(testCase.createdAt) ?? iso(row.createdAt),
          updatedAt: text(testCase.updatedAt) ?? iso(row.updatedAt),
          archivedAt: iso(row.archivedAt),
        }),
      })
    }
    log(`Created/updated ${storedTestCases.length} StoredTestCase nodes`)

    for (const plan of testPlans) {
      const scope = resolveCompanyScope({ companyId: plan.companyId, projectId: plan.projectId })
      await addNode({
        type: 'TestPlan',
        label: plan.title,
        refType: 'TestPlan',
        refId: plan.id,
        description: plan.description ?? undefined,
        metadata: metadata({
          ...scope,
          projectId: plan.projectId ?? null,
          testPlanId: plan.id,
          status: plan.status,
          createdBy: plan.createdById ?? 'system',
          createdAt: iso(plan.createdAt),
          updatedAt: iso(plan.updatedAt),
          archivedAt: iso(plan.archivedAt),
          sourceType: 'test_plan',
        }),
      })
    }
    log(`Created/updated ${testPlans.length} TestPlan nodes`)

    for (const item of testPlanItems) {
      const plan = testPlansById.get(item.planId)
      const scope = resolveCompanyScope({ companyId: plan?.companyId ?? null, projectId: plan?.projectId ?? null })
      await addNode({
        type: 'TestPlanItem',
        label: item.title,
        refType: 'TestPlanItem',
        refId: item.id,
        description: item.notes ?? undefined,
        metadata: metadata({
          ...scope,
          projectId: plan?.projectId ?? null,
          testPlanId: item.planId,
          testCaseId: item.caseId ?? null,
          status: item.status,
          order: item.order,
          createdAt: iso(item.createdAt),
          sourceType: 'test_plan_item',
        }),
      })
    }
    log(`Created/updated ${testPlanItems.length} TestPlanItem nodes`)

    for (const plan of manualTestPlans) {
      const scope = resolveCompanyScope({ companySlug: plan.companySlug, projectId: plan.projectId })
      await addNode({
        type: 'ManualTestPlan',
        label: plan.title,
        refType: 'ManualTestPlan',
        refId: plan.id,
        description: plan.description ?? undefined,
        metadata: metadata({
          ...scope,
          projectId: plan.projectId ?? null,
          projectCode: plan.projectCode ?? null,
          applicationId: plan.applicationId,
          applicationName: plan.applicationName,
          applicationSlug: plan.applicationSlug,
          status: 'active',
          casesCount: Array.isArray(plan.cases) ? plan.cases.length : null,
          hasAutomationConfig: Object.keys(asRecord(plan.automation)).length > 0,
          createdAt: iso(plan.createdAt),
          updatedAt: iso(plan.updatedAt),
          sourceType: 'manual_test_plan',
        }),
      })
    }
    log(`Created/updated ${manualTestPlans.length} ManualTestPlan nodes`)

    for (const run of testRuns) {
      const plan = run.planId ? testPlansById.get(run.planId) : null
      const projectId = run.projectId ?? plan?.projectId ?? null
      const companyId = run.companyId ?? plan?.companyId ?? null
      const scope = resolveCompanyScope({ companyId, projectId })
      await addNode({
        type: 'TestRun',
        label: run.title,
        refType: 'TestRun',
        refId: run.id,
        metadata: metadata({
          ...scope,
          projectId,
          testPlanId: run.planId ?? null,
          status: run.status,
          runSource: run.source,
          browser: run.browser ?? null,
          headless: run.headless,
          passCount: run.passCount,
          failCount: run.failCount,
          skipCount: run.skipCount,
          totalCount: run.totalCount,
          createdBy: run.createdById ?? 'system',
          startedAt: iso(run.startedAt),
          finishedAt: iso(run.finishedAt),
          createdAt: iso(run.createdAt),
          updatedAt: iso(run.updatedAt),
          archivedAt: iso(run.archivedAt),
          sourceType: 'test_run',
        }),
      })
    }
    log(`Created/updated ${testRuns.length} TestRun nodes`)

    for (const result of testRunResults) {
      const run = testRunsById.get(result.runId)
      const plan = run?.planId ? testPlansById.get(run.planId) : null
      const projectId = run?.projectId ?? plan?.projectId ?? null
      const companyId = run?.companyId ?? plan?.companyId ?? null
      const scope = resolveCompanyScope({ companyId, projectId })
      await addNode({
        type: 'TestRunResult',
        label: result.title,
        refType: 'TestRunResult',
        refId: result.id,
        description: result.errorMsg ? result.errorMsg.slice(0, 300) : undefined,
        metadata: metadata({
          ...scope,
          projectId,
          testRunId: result.runId,
          testCaseId: result.caseId ?? null,
          status: result.status,
          durationMs: result.durationMs ?? null,
          retries: result.retries,
          filePath: result.filePath ?? null,
          createdAt: iso(result.createdAt),
          sourceType: 'test_run_result',
        }),
      })
    }
    log(`Created/updated ${testRunResults.length} TestRunResult nodes`)

    const ciTestTrackingNode = await upsertSyncedNode(deps, nodesByRef, {
      type: 'QualityControlTestPolicy',
      label: 'Rastreamento dos testes CI com e-mail capturado',
      refType: 'QualityControlTestPolicy',
      refId: 'ci-email-captured-tests',
      description:
        'No operacional do Brain para rastrear a regra de CI que executa lint/build/testes sem envio real de e-mail.',
      metadata: metadata({
        companySlug: 'testing-company',
        status: 'active',
        category: 'ci-test-tracking',
        purpose: 'Rastrear testes de CI, captura de e-mail e validacoes obrigatorias antes de subir mudancas.',
        workflows: [
          '.github/workflows/ci.yml',
          '.github/workflows/copilot-setup-steps.yml',
        ],
        scripts: [
          'npm run lint',
          'npm run build',
          'npm run test',
          'npm run test:e2e:smoke',
          'npm run test:e2e:access',
        ],
        emailPolicy: {
          captureMode: 'file',
          captureFile: 'test-results/emails/outbox.jsonl',
          accessRequestEmailBypass: true,
          forceEmailSend: false,
          e2eSendRealEmail: false,
          playwrightRealEmail: false,
        },
        sourceType: 'quality_control_test_policy',
      }),
    })
    nodesByRef.set(refKey('QualityControlTestPolicy', 'ci-email-captured-tests'), ciTestTrackingNode)
    nodeCount++
    log('Created/updated QualityControlTestPolicy node')

    log(`Total nodes created/updated: ${nodeCount}`)

    log('Step 3: Creating/updating Brain edges...')

    for (const app of applications) {
      await addEdge('Company', app.companyId, 'Application', app.id, 'HAS_APPLICATION')
      await addEdge('Application', app.id, 'Company', app.companyId, 'BELONGS_TO')
    }

    for (const ticket of tickets) {
      await addEdge('Ticket', ticket.id, 'Company', ticket.companyId, 'BELONGS_TO')
      await addEdge('Ticket', ticket.id, 'User', ticket.createdBy, 'CREATED_BY')
      await addEdge('Ticket', ticket.id, 'User', ticket.assignedToUserId, 'ASSIGNED_TO')
    }

    for (const defect of defects) {
      await addEdge('Defect', defect.id, 'Company', defect.companyId, 'BELONGS_TO')
    }

    for (const membership of memberships) {
      await addEdge('User', membership.userId, 'Company', membership.companyId, 'MEMBER_OF', {
        role: membership.role,
      })
      await addEdge('Company', membership.companyId, 'User', membership.userId, 'HAS_MEMBER', {
        role: membership.role,
      })
    }

    for (const project of projects) {
      await addEdge('Company', project.companyId, 'Project', project.id, 'HAS_PROJECT')
      await addEdge('Project', project.id, 'Company', project.companyId, 'BELONGS_TO')
    }

    for (const membership of memberships) {
      for (const project of projects.filter((item) => item.companyId === membership.companyId)) {
        await addEdge('User', membership.userId, 'Project', project.id, 'MEMBER_OF_PROJECT', {
          role: membership.role,
        })
      }
    }

    for (const document of companyDocuments) {
      const company = companiesBySlug.get(document.companySlug.toLowerCase())
      await addEdge('Company', company?.id, 'CompanyDocument', document.id, 'HAS_DOCUMENT')
    }

    for (const category of wikiCategories) {
      if (!category.companySlug) continue
      const company = companiesBySlug.get(category.companySlug.toLowerCase())
      await addEdge('Company', company?.id, 'WikiCategory', category.id, 'HAS_WIKI_CATEGORY')
    }

    for (const doc of wikiDocs) {
      await addEdge('WikiCategory', doc.categoryId, 'WikiDoc', doc.id, 'HAS_WIKI_DOC')
    }

    for (const row of storedTestCases) {
      const { testCase } = testCaseRecord(row)
      const projectId = text(testCase.projectId) ?? row.projectId
      await addEdge('Project', projectId, 'StoredTestCase', row.id, 'HAS_TEST_CASE')
    }

    for (const plan of testPlans) {
      await addEdge('Project', plan.projectId, 'TestPlan', plan.id, 'HAS_TEST_PLAN')
    }

    for (const item of testPlanItems) {
      await addEdge('TestPlan', item.planId, 'TestPlanItem', item.id, 'HAS_TEST_PLAN_ITEM')
      await addEdge('TestPlanItem', item.id, 'StoredTestCase', item.caseId, 'COVERS_TEST_CASE')
    }

    for (const plan of manualTestPlans) {
      await addEdge('Project', plan.projectId, 'ManualTestPlan', plan.id, 'HAS_MANUAL_TEST_PLAN')
      await addEdge('Application', plan.applicationId, 'ManualTestPlan', plan.id, 'HAS_MANUAL_TEST_PLAN')
    }

    for (const run of testRuns) {
      const plan = run.planId ? testPlansById.get(run.planId) : null
      await addEdge('Project', run.projectId ?? plan?.projectId, 'TestRun', run.id, 'HAS_TEST_RUN')
      await addEdge('TestPlan', run.planId, 'TestRun', run.id, 'HAS_TEST_RUN')
    }

    for (const result of testRunResults) {
      await addEdge('TestRun', result.runId, 'TestRunResult', result.id, 'HAS_TEST_RUN_RESULT')
      await addEdge('TestRunResult', result.id, 'StoredTestCase', result.caseId, 'EXECUTES_TEST_CASE')
    }

    const testingCompany = companies.find((company) => {
      const slug = company.slug.trim().toLowerCase()
      const name = company.name.trim().toLowerCase()
      return slug === 'testing-company' || name === 'testing company'
    })
    await addEdge(
      'QualityControlTestPolicy',
      'ci-email-captured-tests',
      'Company',
      testingCompany?.id,
      'GOVERNS_COMPANY',
      { companySlug: 'testing-company' },
    )

    for (const plan of testPlans) {
      const project = plan.projectId ? projectsById.get(plan.projectId) : null
      const company = companiesById.get(plan.companyId)
      if (
        company?.slug === 'testing-company' ||
        project?.companyId === testingCompany?.id ||
        (!testingCompany && plan.status === 'active')
      ) {
        await addEdge(
          'QualityControlTestPolicy',
          'ci-email-captured-tests',
          'TestPlan',
          plan.id,
          'GOVERNS_TEST_PLAN',
          { companySlug: company?.slug ?? 'testing-company' },
        )
      }
    }

    log(`Total edges created/updated: ${edgeCount}`)

    log('Step 4: Validating integrity...')
    const validation = await validateBrainIntegrity()

    if (validation.valid) {
      log('Brain integrity: VALID')
    } else {
      logError('Brain integrity: INVALID', {
        errors: validation.errors,
      })
    }

    log(`Stats:\n  - Nodes: ${validation.stats.nodes}\n  - Edges: ${validation.stats.edges}\n  - Memories: ${validation.stats.memories}`)

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

if (require.main === module) {
  syncBrain()
    .then((result) => {
      console.log('Final result:', result)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}
