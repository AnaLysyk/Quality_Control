import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { prisma } from '@/lib/prismaClient'
import {
  upsertNode,
  connectNodes,
  addMemory,
  getNodeWithContext,
  searchNodes,
  getNodeMemories,
  traceImpact,
  getSubgraph,
  validateBrainIntegrity,
} from '@/lib/brain'

describe('Brain - Cérebro do Quality Control', () => {
  let testCompanyNodeId: string
  let testAppNodeId: string
  let testModuleNodeId: string

  beforeAll(async () => {
    // Limpar dados de teste
    await prisma.brainMemory.deleteMany()
    await prisma.brainAuditLog.deleteMany()
    await prisma.brainEdge.deleteMany()
    await prisma.brainNode.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Node Operations', () => {
    it('should create a Company node', async () => {
      const node = await upsertNode({
        type: 'Company',
        label: 'Test Company',
        refType: 'Company',
        refId: 'test-company-1',
        description: 'A test company',
        metadata: { industry: 'Tech' },
      })

      expect(node).toBeDefined()
      expect(node.type).toBe('Company')
      expect(node.label).toBe('Test Company')
      expect(node.refType).toBe('Company')
      expect(node.refId).toBe('test-company-1')

      testCompanyNodeId = node.id
    })

    it('should create an Application node', async () => {
      const node = await upsertNode({
        type: 'Application',
        label: 'Test App',
        refType: 'Application',
        refId: 'test-app-1',
        metadata: { companyId: 'test-company-1' },
      })

      expect(node.type).toBe('Application')
      expect(node.label).toBe('Test App')

      testAppNodeId = node.id
    })

    it('should create a Module node', async () => {
      const node = await upsertNode({
        type: 'Module',
        label: 'Auth Module',
        refType: 'Module',
        refId: 'test-module-1',
        metadata: { applicationId: 'test-app-1' },
      })

      expect(node.type).toBe('Module')

      testModuleNodeId = node.id
    })

    it('should update existing node by refType and refId', async () => {
      const updated = await upsertNode({
        type: 'Company',
        label: 'Test Company Updated',
        refType: 'Company',
        refId: 'test-company-1',
        description: 'Updated description',
      })

      expect(updated.id).toBe(testCompanyNodeId)
      expect(updated.label).toBe('Test Company Updated')
      expect(updated.description).toBe('Updated description')
    })

    it('should search nodes by type', async () => {
      const results = await searchNodes({ type: 'Company' })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe('Company')
    })

    it('should search nodes by label', async () => {
      const results = await searchNodes({ label: 'Test App' })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].label).toContain('Test App')
    })
  })

  describe('Edge Operations', () => {
    it('should create an edge between two nodes', async () => {
      const edge = await connectNodes(
        testCompanyNodeId,
        testAppNodeId,
        'HAS_APPLICATION'
      )

      expect(edge).toBeDefined()
      expect(edge.fromId).toBe(testCompanyNodeId)
      expect(edge.toId).toBe(testAppNodeId)
      expect(edge.type).toBe('HAS_APPLICATION')
    })

    it('should create edge with metadata', async () => {
      const edge = await connectNodes(
        testAppNodeId,
        testModuleNodeId,
        'HAS_MODULE',
        { order: 1 }
      )

      expect(edge.metadata).toEqual({ order: 1 })
    })

    it('should not create duplicate edges', async () => {
      const edge1 = await connectNodes(testAppNodeId, testModuleNodeId, 'HAS_MODULE')
      const edge2 = await connectNodes(testAppNodeId, testModuleNodeId, 'HAS_MODULE')

      expect(edge1.id).toBe(edge2.id)
    })

    it('should fail if source node does not exist', async () => {
      const fakeId = 'fake-node-id'

      await expect(
        connectNodes(fakeId, testModuleNodeId, 'HAS_MODULE')
      ).rejects.toThrow()
    })

    it('should fail if target node does not exist', async () => {
      const fakeId = 'fake-node-id'

      await expect(
        connectNodes(testModuleNodeId, fakeId, 'HAS_MODULE')
      ).rejects.toThrow()
    })
  })

  describe('Memory Operations', () => {
    it('should add a memory', async () => {
      const memory = await addMemory({
        title: 'Rule: Validate email',
        summary: 'All email fields must be validated before submission',
        memoryType: 'RULE',
        importance: 4,
        relatedNodeIds: [testModuleNodeId],
        sourceType: 'MANUAL',
      })

      expect(memory).toBeDefined()
      expect(memory.title).toBe('Rule: Validate email')
      expect(memory.memoryType).toBe('RULE')
      expect(memory.status).toBe('ACTIVE')
    })

    it('should retrieve memories for a node', async () => {
      // Adicionar memória
      await addMemory({
        title: 'Pattern: Singleton',
        summary: 'Use singleton pattern for services',
        memoryType: 'PATTERN',
        importance: 3,
        relatedNodeIds: [testAppNodeId],
      })

      // Recuperar
      const memories = await getNodeMemories(testAppNodeId)

      expect(memories.length).toBeGreaterThan(0)
      expect(memories[0].memoryType).toBeDefined()
    })

    it('should add memory with multiple related nodes', async () => {
      const memory = await addMemory({
        title: 'Decision: Use JWT',
        summary: 'Decided to use JWT tokens for authentication',
        memoryType: 'DECISION',
        importance: 5,
        relatedNodeIds: [testCompanyNodeId, testModuleNodeId],
      })

      expect(Array.isArray(memory.relatedNodeIds)).toBe(true)
      const ids = memory.relatedNodeIds as unknown as string[]
      expect(ids.length).toBe(2)
    })
  })

  describe('Context Queries', () => {
    it('should retrieve node with context', async () => {
      const context = await getNodeWithContext(testCompanyNodeId)

      expect(context).toBeDefined()
      expect(context?.node?.id).toBe(testCompanyNodeId)
      expect(context?.outgoing).toBeDefined()
      expect(context?.incoming).toBeDefined()
      expect(context?.neighbors).toBeDefined()
    })

    it('should trace impact from a node', async () => {
      const impact = await traceImpact(testCompanyNodeId, 2)

      expect(impact).toBeDefined()
      expect(impact.impactedNodes).toBeDefined()
      expect(impact.paths).toBeDefined()
    })

    it('should retrieve subgraph', async () => {
      const subgraph = await getSubgraph(testCompanyNodeId, 2)

      expect(subgraph).toBeDefined()
      expect(subgraph.nodes).toBeDefined()
      expect(subgraph.edges).toBeDefined()
      expect(subgraph.root).toBeDefined()
    })
  })

  describe('Validation', () => {
    it('should validate brain integrity', async () => {
      const validation = await validateBrainIntegrity()

      expect(validation.valid).toBe(true)
      expect(validation.errors).toEqual([])
      expect(validation.stats.nodes).toBeGreaterThan(0)
      expect(validation.stats.edges).toBeGreaterThan(0)
    })

    it('should report correct statistics', async () => {
      const validation = await validateBrainIntegrity()

      expect(validation.stats).toHaveProperty('nodes')
      expect(validation.stats).toHaveProperty('edges')
      expect(validation.stats).toHaveProperty('memories')
      expect(typeof validation.stats.nodes).toBe('number')
    })
  })

  describe('Audit Logging', () => {
    it('should log node creation', async () => {
      const before = await prisma.brainAuditLog.count()

      await upsertNode({
        type: 'Ticket',
        label: 'Test Ticket',
        refType: 'Ticket',
        refId: 'test-ticket-1',
      })

      const after = await prisma.brainAuditLog.count()

      expect(after).toBeGreaterThan(before)

      const auditEntry = await prisma.brainAuditLog.findFirst({
        where: { action: 'CREATE_NODE' },
        orderBy: { createdAt: 'desc' },
      })

      expect(auditEntry).toBeDefined()
      expect(auditEntry?.entityType).toBe('BrainNode')
    })

    it('should log edge creation', async () => {
      const ticket = await upsertNode({
        type: 'Ticket',
        label: 'Another Ticket',
        refType: 'Ticket',
        refId: 'test-ticket-2',
      })

      const before = await prisma.brainAuditLog.count()

      await connectNodes(testCompanyNodeId, ticket.id, 'RELATES_TO')

      const after = await prisma.brainAuditLog.count()

      expect(after).toBeGreaterThan(before)
    })

    it('should log memory addition', async () => {
      const before = await prisma.brainAuditLog.count()

      await addMemory({
        title: 'Exception: Handle timeout',
        summary: 'When API timeout occurs, retry 3 times',
        memoryType: 'EXCEPTION',
        importance: 3,
      })

      const after = await prisma.brainAuditLog.count()

      expect(after).toBeGreaterThan(before)
    })
  })

  describe('Complex Scenarios', () => {
    it('should build a company → app → module hierarchy', async () => {
      const company = await upsertNode({
        type: 'Company',
        label: 'Hierarchy Test',
        refType: 'Company',
        refId: 'hierarchy-company',
      })

      const app = await upsertNode({
        type: 'Application',
        label: 'Hierarchy App',
        refType: 'Application',
        refId: 'hierarchy-app',
      })

      const module = await upsertNode({
        type: 'Module',
        label: 'Hierarchy Module',
        refType: 'Module',
        refId: 'hierarchy-module',
      })

      await connectNodes(company.id, app.id, 'HAS_APPLICATION')
      await connectNodes(app.id, module.id, 'HAS_MODULE')

      const context = await getNodeWithContext(company.id, 2)

      expect(context?.neighbors.some(n => n.id === app.id)).toBe(true)
    })

    it('should handle queries on complex subgraphs', async () => {
      const validation = await validateBrainIntegrity()

      if (validation.stats.nodes > 5) {
        const firstNode = await prisma.brainNode.findFirst()

        if (firstNode) {
          const subgraph = await getSubgraph(firstNode.id, 3)

          expect(subgraph.nodes.length).toBeGreaterThan(0)
        }
      }
    })
  })
})
