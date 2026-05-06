import { prisma } from '@/lib/prismaClient'
import {
  upsertNode,
  connectNodes,
  validateBrainIntegrity,
} from '@/lib/brain'

const log = (msg: string) => console.log(`[SYNC] ${msg}`)
const logError = (msg: string, error?: any) =>
  console.error(`[SYNC ERROR] ${msg}`, error?.message || '')

/**
 * Sincronização inicial do Brain
 * Popula BrainNode, BrainEdge e valida integridade
 */
export async function syncBrain() {
  log('===== STARTING BRAIN SYNC =====')
  const startTime = Date.now()

  try {
    // ===== STEP 1: Limpar dados antigos (opcional)
    // await prisma.brainAuditLog.deleteMany({})
    // await prisma.brainMemory.deleteMany({})
    // await prisma.brainEdge.deleteMany({})
    // await prisma.brainNode.deleteMany({})
    // log('Cleaned old brain data')

    // ===== STEP 2: Criar nós para cada entidade
    log('Step 1: Creating nodes from entities...')
    let nodeCount = 0

    // Companies
    const companies = await prisma.company.findMany()
    for (const company of companies) {
      await upsertNode({
        type: 'Company',
        label: company.name,
        refType: 'Company',
        refId: company.id,
        description: company.short_description || undefined,
        metadata: {
          status: company.status,
        },
      })
      nodeCount++
    }
    log(`Created ${companies.length} Company nodes`)

    // Applications
    const applications = await prisma.application.findMany()
    for (const app of applications) {
      await upsertNode({
        type: 'Application',
        label: app.name,
        refType: 'Application',
        refId: app.id,
        description: app.description || undefined,
        metadata: {
          companyId: app.companyId,
          status: app.active ? 'active' : 'inactive',
        },
      })
      nodeCount++
    }
    log(`Created ${applications.length} Application nodes`)

    // Tickets
    const tickets = await prisma.ticket.findMany()
    for (const ticket of tickets) {
      await upsertNode({
        type: 'Ticket',
        label: ticket.title,
        refType: 'Ticket',
        refId: ticket.id,
        description: ticket.description || undefined,
        metadata: {
          companyId: ticket.companyId,
          status: ticket.status,
          priority: ticket.priority,
        },
      })
      nodeCount++
    }
    log(`Created ${tickets.length} Ticket nodes`)

    // Defects
    const defects = await prisma.defect.findMany()
    for (const defect of defects) {
      await upsertNode({
        type: 'Defect',
        label: defect.title,
        refType: 'Defect',
        refId: defect.id,
        description: defect.description || undefined,
        metadata: {
          companyId: defect.companyId,
        },
      })
      nodeCount++
    }
    log(`Created ${defects.length} Defect nodes`)

    // Users
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
        },
      })
      nodeCount++
    }
    log(`Created ${users.length} User nodes`)

    log(`✓ Total nodes created: ${nodeCount}`)

    // ===== STEP 3: Criar arestas entre entidades
    log('Step 2: Creating edges between entities...')
    let edgeCount = 0

    // Company → Application (HAS_APPLICATION)
    for (const app of applications) {
      const companyNode = await prisma.brainNode.findFirst({
        where: { refType: 'Company', refId: app.companyId },
      })
      const appNode = await prisma.brainNode.findFirst({
        where: { refType: 'Application', refId: app.id },
      })
      if (companyNode && appNode) {
        await connectNodes(companyNode.id, appNode.id, 'HAS_APPLICATION')
        edgeCount++
      }
    }
    log(`Created Application edges`)

    // Ticket → Company (BELONGS_TO)
    for (const ticket of tickets) {
      const ticketNode = await prisma.brainNode.findFirst({
        where: { refType: 'Ticket', refId: ticket.id },
      })
      const companyNode = await prisma.brainNode.findFirst({
        where: { refType: 'Company', refId: ticket.companyId },
      })
      if (ticketNode && companyNode) {
        await connectNodes(ticketNode.id, companyNode.id, 'BELONGS_TO')
        edgeCount++
      }
    }
    log(`Created Ticket-Company edges`)

    // Ticket → User (CREATED_BY)
    for (const ticket of tickets) {
      if (ticket.createdBy) {
        const ticketNode = await prisma.brainNode.findFirst({
          where: { refType: 'Ticket', refId: ticket.id },
        })
        const userNode = await prisma.brainNode.findFirst({
          where: { refType: 'User', refId: ticket.createdBy },
        })
        if (ticketNode && userNode) {
          await connectNodes(ticketNode.id, userNode.id, 'CREATED_BY')
          edgeCount++
        }
      }
    }
    log(`Created Ticket-Creator edges`)

    // Ticket → User (ASSIGNED_TO)
    for (const ticket of tickets) {
      if (ticket.assignedToUserId) {
        const ticketNode = await prisma.brainNode.findFirst({
          where: { refType: 'Ticket', refId: ticket.id },
        })
        const userNode = await prisma.brainNode.findFirst({
          where: { refType: 'User', refId: ticket.assignedToUserId },
        })
        if (ticketNode && userNode) {
          await connectNodes(ticketNode.id, userNode.id, 'ASSIGNED_TO')
          edgeCount++
        }
      }
    }
    log(`Created Ticket-Assignee edges`)

    // User → Company (MEMBER_OF)
    const memberships = await prisma.membership.findMany()
    for (const membership of memberships) {
      const userNode = await prisma.brainNode.findFirst({
        where: { refType: 'User', refId: membership.userId },
      })
      const companyNode = await prisma.brainNode.findFirst({
        where: { refType: 'Company', refId: membership.companyId },
      })
      if (userNode && companyNode) {
        await connectNodes(userNode.id, companyNode.id, 'MEMBER_OF', {
          role: membership.role,
        })
        edgeCount++
      }
    }
    log(`Created User-Company edges`)

    log(`✓ Total edges created: ${edgeCount}`)

    // ===== STEP 4: Validar integridade
    log('Step 3: Validating integrity...')
    const validation = await validateBrainIntegrity()

    if (validation.valid) {
      log(`✓ Brain integrity: VALID`)
    } else {
      logError('Brain integrity: INVALID', {
        errors: validation.errors,
      })
    }

    log(`\nStats:\n  - Nodes: ${validation.stats.nodes}\n  - Edges: ${validation.stats.edges}\n  - Memories: ${validation.stats.memories}\n    `)

    // ===== STEP 5: Registrar conclusão
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
