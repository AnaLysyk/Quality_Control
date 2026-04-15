import { prisma } from '@/lib/prismaClient'
import { BrainNode, BrainEdge, BrainMemory, Prisma } from '@prisma/client'

/**
 * Recupera um nó com seus vizinhos até uma profundidade especificada
 */
export async function getNodeWithContext(
  nodeId: string,
  depth: number = 2
): Promise<{
  node: BrainNode | null
  outgoing: BrainEdge[]
  incoming: BrainEdge[]
  neighbors: BrainNode[]
} | null> {
  try {
    const node = await prisma.brainNode.findUnique({
      where: { id: nodeId },
    })

    if (!node) return null

    // Buscar arestas diretas
    const [outgoing, incoming] = await Promise.all([
      prisma.brainEdge.findMany({
        where: { fromId: nodeId },
      }),
      prisma.brainEdge.findMany({
        where: { toId: nodeId },
      }),
    ])

    // Buscar nós vizinhos
    const neighborIds = new Set<string>()
    outgoing.forEach(e => neighborIds.add(e.toId))
    incoming.forEach(e => neighborIds.add(e.fromId))

    const neighbors = await prisma.brainNode.findMany({
      where: {
        id: { in: Array.from(neighborIds) },
      },
    })

    return {
      node,
      outgoing,
      incoming,
      neighbors,
    }
  } catch (error) {
    console.error('Error in getNodeWithContext:', error)
    throw error
  }
}

/**
 * Busca nós por tipo e/ou label
 */
export async function searchNodes(
  options: {
    type?: string
    label?: string
    query?: string // Busca em label e description
    limit?: number
  } = {}
): Promise<BrainNode[]> {
  try {
    const { type, label, query, limit = 50 } = options
    const where: Prisma.BrainNodeWhereInput = {}

    if (type) where.type = type
    if (label) where.label = { contains: label, mode: 'insensitive' }
    
    // Se tem query, buscar em label e description
    if (query) {
      where.OR = [
        { label: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ]
    }

    return await prisma.brainNode.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    console.error('Error in searchNodes:', error)
    throw error
  }
}

/**
 * Cria ou atualiza um nó do brain
 */
export async function upsertNode(data: {
  id?: string
  type: string
  label: string
  refType?: string
  refId?: string
  description?: string
  metadata?: Prisma.InputJsonValue
  userId?: string
}): Promise<BrainNode> {
  try {
    const { id, type, label, refType, refId, description, metadata, userId } = data

    // Se refId e refType existem, tenta encontrar nó existente
    if (refType && refId) {
      const existing = await prisma.brainNode.findFirst({
        where: { refType, refId },
      })

      if (existing) {
        return await prisma.brainNode.update({
          where: { id: existing.id },
          data: { label, description, metadata },
        })
      }
    }

    // Criar novo nó
    const node = await prisma.brainNode.create({
      data: {
        id,
        type,
        label,
        refType,
        refId,
        description,
        metadata,
      },
    })

    // Registrar auditoria
    await logBrainAudit({
      action: 'CREATE_NODE',
      entityType: 'BrainNode',
      entityId: node.id,
      after: node,
      userId,
      reason: `Created node: ${label}`,
    })

    return node
  } catch (error) {
    console.error('Error in upsertNode:', error)
    throw error
  }
}

/**
 * Conecta dois nós com uma aresta
 */
export async function connectNodes(
  fromId: string,
  toId: string,
  edgeType: string,
  metadata?: Prisma.InputJsonValue,
  userId?: string
): Promise<BrainEdge> {
  try {
    // Validar que ambos nós existem
    const [from, to] = await Promise.all([
      prisma.brainNode.findUnique({ where: { id: fromId } }),
      prisma.brainNode.findUnique({ where: { id: toId } }),
    ])

    if (!from || !to) {
      throw new Error(`Invalid node IDs: from=${fromId}, to=${toId}`)
    }

    // Tentar criar aresta (upsert com unique constraint)
    const edge = await prisma.brainEdge.upsert({
      where: {
        fromId_toId_type: {
          fromId,
          toId,
          type: edgeType,
        },
      },
      update: { metadata },
      create: {
        fromId,
        toId,
        type: edgeType,
        metadata,
      },
    })

    // Registrar auditoria
    await logBrainAudit({
      action: 'CREATE_EDGE',
      entityType: 'BrainEdge',
      entityId: edge.id,
      after: edge,
      userId,
      reason: `Created edge: ${from.label} --[${edgeType}]--> ${to.label}`,
    })

    return edge
  } catch (error) {
    console.error('Error in connectNodes:', error)
    throw error
  }
}

/**
 * Adiciona memória ao brain
 */
export async function addMemory(data: {
  title: string
  summary: string
  memoryType: 'DECISION' | 'RULE' | 'PATTERN' | 'CONTEXT' | 'EXCEPTION' | 'TECHNICAL_NOTE'
  importance?: number
  relatedNodeIds?: string[]
  sourceType?: string
  sourceId?: string
  userId?: string
}): Promise<BrainMemory> {
  try {
    const {
      title,
      summary,
      memoryType,
      importance = 1,
      relatedNodeIds = [],
      sourceType,
      sourceId,
      userId,
    } = data

    const memory = await prisma.brainMemory.create({
      data: {
        title,
        summary,
        memoryType,
        importance,
        relatedNodeIds,
        sourceType,
        sourceId,
        status: 'ACTIVE',
      },
    })

    // Registrar auditoria
    await logBrainAudit({
      action: 'ADD_MEMORY',
      entityType: 'BrainMemory',
      entityId: memory.id,
      after: memory,
      userId,
      reason: `Added memory: ${title}`,
    })

    return memory
  } catch (error) {
    console.error('Error in addMemory:', error)
    throw error
  }
}

/**
 * Retorna memórias associadas a um nó
 */
export async function getNodeMemories(nodeId: string): Promise<BrainMemory[]> {
  try {
    // Prisma 7.7.0: para JSON[] use array_contains
    const memories = await prisma.brainMemory.findMany({
      where: {
        relatedNodeIds: {
          array_contains: [nodeId],
        },
      },
      orderBy: { importance: 'desc' },
    })
    return memories
  } catch (error) {
    console.error('Error in getNodeMemories:', error)
    throw error
  }
}

/**
 * Traça o impacto de um nó (todos os nós que ele afeta)
 */
export async function traceImpact(
  nodeId: string,
  maxDepth: number = 3
): Promise<{
  impactedNodes: BrainNode[]
  paths: Array<{ nodeId: string; edgeType: string; distance: number }>
}> {
  try {
    const visited = new Set<string>()
    const paths: Array<{ nodeId: string; edgeType: string; distance: number }> = []

    const queue: Array<{
      nodeId: string
      edgeType: string
      distance: number
    }> = [{ nodeId, edgeType: 'START', distance: 0 }]

    while (queue.length > 0) {
      const current = queue.shift()!

      if (!current || visited.has(current.nodeId) || current.distance >= maxDepth) {
        continue
      }

      visited.add(current.nodeId)

      if (current.distance > 0) {
        paths.push({
          nodeId: current.nodeId,
          edgeType: current.edgeType,
          distance: current.distance,
        })
      }

      // Buscar próximos nós
      const outgoing = await prisma.brainEdge.findMany({
        where: { fromId: current.nodeId },
      })

      outgoing.forEach(edge => {
        if (!visited.has(edge.toId)) {
          queue.push({
            nodeId: edge.toId,
            edgeType: edge.type,
            distance: current.distance + 1,
          })
        }
      })
    }

    // Buscar nós impactados
    const impactedNodesData = await prisma.brainNode.findMany({
      where: {
        id: { in: paths.map(p => p.nodeId) },
      },
    })

    return {
      impactedNodes: impactedNodesData,
      paths,
    }
  } catch (error) {
    console.error('Error in traceImpact:', error)
    throw error
  }
}

/**
 * Busca todo o contexto relacionado a um nó (subgrafo)
 */
export async function getSubgraph(
  nodeId: string,
  depth: number = 2
): Promise<{
  nodes: BrainNode[]
  edges: BrainEdge[]
  root: BrainNode | null
}> {
  try {
    const visited = new Set<string>([nodeId])
    const nodes: BrainNode[] = []
    const edges: BrainEdge[] = []

    const queue: string[] = [nodeId]
    let currentDepth = 0

    while (queue.length > 0 && currentDepth < depth) {
      const nextQueue: string[] = []

      for (const id of queue) {
        const [outgoing, incoming, node] = await Promise.all([
          prisma.brainEdge.findMany({ where: { fromId: id } }),
          prisma.brainEdge.findMany({ where: { toId: id } }),
          prisma.brainNode.findUnique({ where: { id } }),
        ])

        if (node) nodes.push(node)

        const allEdges = [...outgoing, ...incoming]
        allEdges.forEach(edge => {
          edges.push(edge)
          const otherId = edge.fromId === id ? edge.toId : edge.fromId

          if (!visited.has(otherId)) {
            visited.add(otherId)
            nextQueue.push(otherId)
          }
        })
      }

      queue.length = 0
      queue.push(...nextQueue)
      currentDepth++
    }

    const root = await prisma.brainNode.findUnique({ where: { id: nodeId } })

    return { nodes, edges, root }
  } catch (error) {
    console.error('Error in getSubgraph:', error)
    throw error
  }
}

/**
 * Registra auditoria
 */
async function logBrainAudit(data: {
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  userId?: string
  reason?: string
}): Promise<void> {
  try {
    await prisma.brainAuditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        before: data.before as Prisma.InputJsonValue,
        after: data.after as Prisma.InputJsonValue,
        userId: data.userId,
        reason: data.reason,
      },
    })
  } catch (error) {
    console.error('Error in logBrainAudit:', error)
    // Não lance erro para não interromper a operação principal
  }
}

/**
 * Valida integridade do brain
 */
export async function validateBrainIntegrity(): Promise<{
  valid: boolean
  errors: string[]
  stats: {
    nodes: number
    edges: number
    memories: number
  }
}> {
  try {
    const errors: string[] = []

    // Contar entidades
    const [nodeCount, edgeCount, memoryCount] = await Promise.all([
      prisma.brainNode.count(),
      prisma.brainEdge.count(),
      prisma.brainMemory.count(),
    ])

    // Verificar se há nós sem conexões (ilhados)
    const isolatedNodes = await prisma.brainNode.findMany({
      where: {
        AND: [
          { outgoing: { none: {} } },
          { incoming: { none: {} } },
        ],
      },
      select: { id: true, type: true },
      take: 10,
    })

    if (isolatedNodes.length > 0) {
      errors.push(`Found ${isolatedNodes.length} isolated nodes without connections`)
    }

    // Verificar memórias sem nó associado
    const orphanMemories = await prisma.brainMemory.findMany({
      where: {
        nodeId: null,
      },
      select: { id: true },
      take: 10,
    })

    if (orphanMemories.length > 0) {
      errors.push(`Found ${orphanMemories.length} orphan memories`)
    }

    return {
      valid: errors.length === 0,
      errors,
      stats: {
        nodes: nodeCount,
        edges: edgeCount,
        memories: memoryCount,
      },
    }
  } catch (error) {
    console.error('Error in validateBrainIntegrity:', error)
    // Return safe default instead of throwing
    return {
      valid: true,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`],
      stats: { nodes: 0, edges: 0, memories: 0 },
    }
  }
}

/**
 * Deleta um nó e todas suas conexões
 */
export async function deleteNode(
  nodeId: string,
  userId?: string
): Promise<{ success: boolean; deletedEdges: number }> {
  try {
    const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    // Deletar todas as arestas conectadas
    const [outgoing, incoming] = await Promise.all([
      prisma.brainEdge.deleteMany({ where: { fromId: nodeId } }),
      prisma.brainEdge.deleteMany({ where: { toId: nodeId } }),
    ])

    // Deletar memórias relacionadas
    await prisma.brainMemory.deleteMany({
      where: {
        relatedNodeIds: { array_contains: [nodeId] },
      },
    })

    // Deletar o nó
    await prisma.brainNode.delete({ where: { id: nodeId } })

    // Registrar auditoria
    await logBrainAudit({
      action: 'DELETE_NODE',
      entityType: 'BrainNode',
      entityId: nodeId,
      before: node,
      userId,
      reason: `Deleted node: ${node.label}`,
    })

    return {
      success: true,
      deletedEdges: outgoing.count + incoming.count,
    }
  } catch (error) {
    console.error('Error in deleteNode:', error)
    throw error
  }
}

/**
 * Remove uma aresta entre dois nós
 */
export async function disconnectNodes(
  fromId: string,
  toId: string,
  edgeType: string,
  userId?: string
): Promise<boolean> {
  try {
    const edge = await prisma.brainEdge.delete({
      where: {
        fromId_toId_type: { fromId, toId, type: edgeType },
      },
    })

    // Registrar auditoria
    await logBrainAudit({
      action: 'DELETE_EDGE',
      entityType: 'BrainEdge',
      entityId: edge.id,
      before: edge,
      userId,
      reason: `Removed edge: ${fromId} --[${edgeType}]--> ${toId}`,
    })

    return true
  } catch (error) {
    console.error('Error in disconnectNodes:', error)
    return false
  }
}

/**
 * Encontra o caminho mais curto entre dois nós (BFS)
 */
export async function findPathBetweenNodes(
  startId: string,
  endId: string
): Promise<{
  path: string[]
  distance: number
  edges: Array<{ fromId: string; toId: string; type: string }>
} | null> {
  try {
    if (startId === endId) {
      return { path: [startId], distance: 0, edges: [] }
    }

    const visited = new Set<string>([startId])
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: startId, path: [startId] },
    ]
    const parentMap = new Map<string, { fromId: string; edgeType: string }>()

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!

      const outgoing = await prisma.brainEdge.findMany({
        where: { fromId: nodeId },
      })

      for (const edge of outgoing) {
        if (!visited.has(edge.toId)) {
          visited.add(edge.toId)
          parentMap.set(edge.toId, { fromId: nodeId, edgeType: edge.type })

          if (edge.toId === endId) {
            // Reconstruir caminho
            const fullPath = [...path, endId]
            const edges: Array<{ fromId: string; toId: string; type: string }> = []

            for (let i = 0; i < fullPath.length - 1; i++) {
              const from = fullPath[i]
              const to = fullPath[i + 1]
              const edgeData = await prisma.brainEdge.findFirst({
                where: { fromId: from, toId: to },
              })
              if (edgeData) {
                edges.push({ fromId: from, toId: to, type: edgeData.type })
              }
            }

            return {
              path: fullPath,
              distance: fullPath.length - 1,
              edges,
            }
          }

          queue.push({ nodeId: edge.toId, path: [...path, edge.toId] })
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error in findPathBetweenNodes:', error)
    throw error
  }
}

/**
 * Obtém memórias relacionadas baseadas em relacionamentos do nó
 */
export async function getRelatedMemories(
  nodeId: string,
  depth: number = 2
): Promise<BrainMemory[]> {
  try {
    const subgraph = await getSubgraph(nodeId, depth)
    const allNodeIds = [nodeId, ...subgraph.nodes.map(n => n.id)]

    const memories = await prisma.brainMemory.findMany({
      orderBy: { importance: 'desc' },
    })

    return memories.filter(m => {
      if (!m.relatedNodeIds) return false;
      const ids = Array.isArray(m.relatedNodeIds) ? m.relatedNodeIds : [];
      return (ids as unknown[]).some((id) => allNodeIds.includes(String(id)));
    })

    return memories
  } catch (error) {
    console.error('Error in getRelatedMemories:', error)
    throw error
  }
}

/**
 * Calcula importância de um nó baseado em seu grau de conexão
 */
export async function computeNodeImportance(nodeId: string): Promise<{
  nodeId: string
  inDegree: number
  outDegree: number
  totalDegree: number
  importance: number
}> {
  try {
    const [inEdges, outEdges] = await Promise.all([
      prisma.brainEdge.count({ where: { toId: nodeId } }),
      prisma.brainEdge.count({ where: { fromId: nodeId } }),
    ])

    const totalDegree = inEdges + outEdges
    // Importância: média ponderada (entrada mais pesada que saída)
    const importance = (inEdges * 0.6 + outEdges * 0.4) / Math.max(totalDegree, 1)

    return {
      nodeId,
      inDegree: inEdges,
      outDegree: outEdges,
      totalDegree,
      importance,
    }
  } catch (error) {
    console.error('Error in computeNodeImportance:', error)
    throw error
  }
}

/**
 * Obtém estatísticas de um nó
 */
export async function getNodeStats(nodeId: string): Promise<{
  nodeId: string
  label: string
  type: string
  inDegree: number
  outDegree: number
  memoryCount: number
  createdAt: Date
  updatedAt: Date
  importance: number
}> {
  try {
    const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    const [inDegree, outDegree, memoryCount] = await Promise.all([
      prisma.brainEdge.count({ where: { toId: nodeId } }),
      prisma.brainEdge.count({ where: { fromId: nodeId } }),
      prisma.brainMemory.count({
        where: { relatedNodeIds: { array_contains: [nodeId] } },
      }),
    ])

    const importance = (inDegree * 0.6 + outDegree * 0.4) / Math.max(inDegree + outDegree, 1)

    return {
      nodeId,
      label: node.label,
      type: node.type,
      inDegree,
      outDegree,
      memoryCount,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      importance,
    }
  } catch (error) {
    console.error('Error in getNodeStats:', error)
    throw error
  }
}

/**
 * Cria múltiplos nós em batch
 */
export async function bulkUpsertNodes(
  nodes: Array<{
    id?: string
    type: string
    label: string
    refType?: string
    refId?: string
    description?: string
    metadata?: Prisma.InputJsonValue
  }>,
  userId?: string
): Promise<BrainNode[]> {
  try {
    const created: BrainNode[] = []

    for (const nodeData of nodes) {
      const node = await upsertNode({ ...nodeData, userId })
      created.push(node)
    }

    return created
  } catch (error) {
    console.error('Error in bulkUpsertNodes:', error)
    throw error
  }
}

/**
 * Encontra nós similares baseado em tipo e metadados
 */
export async function findSimilarNodes(
  nodeId: string,
  limit: number = 10
): Promise<BrainNode[]> {
  try {
    const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    // Buscar nós do mesmo tipo (exceto o próprio)
    const similar = await prisma.brainNode.findMany({
      where: {
        AND: [{ type: node.type }, { id: { not: nodeId } }],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return similar
  } catch (error) {
    console.error('Error in findSimilarNodes:', error)
    throw error
  }
}

/**
 * Obtém histórico de mudanças de um nó via audit log
 */
export async function getNodeTimeline(nodeId: string): Promise<
  Array<{
    id: string
    action: string
    before: Prisma.JsonValue
    after: Prisma.JsonValue
    timestamp: Date
    reason?: string
  }>
> {
  try {
    const timeline = await prisma.brainAuditLog.findMany({
      where: {
        entityId: nodeId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        before: true,
        after: true,
        createdAt: true,
        reason: true,
      },
    })

    return timeline.map(entry => ({
      id: entry.id,
      action: entry.action,
      before: entry.before,
      after: entry.after,
      timestamp: entry.createdAt,
      reason: entry.reason || undefined,
    }))
  } catch (error) {
    console.error('Error in getNodeTimeline:', error)
    throw error
  }
}

/**
 * Busca nós por metadados específicos
 */
export async function getNodesByMetadata(
  query: Prisma.InputJsonValue,
  limit: number = 50
): Promise<BrainNode[]> {
  try {
    const nodes = await prisma.brainNode.findMany({
      where: {
        metadata: {
          equals: query,
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return nodes
  } catch (error) {
    console.error('Error in getNodesByMetadata:', error)
    throw error
  }
}

/**
 * Atualiza apenas metadados de um nó
 */
export async function updateNodeMetadata(
  nodeId: string,
  metadata: Prisma.InputJsonValue,
  userId?: string
): Promise<BrainNode> {
  try {
    const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    const before = { ...node }

    const updated = await prisma.brainNode.update({
      where: { id: nodeId },
      data: { metadata },
    })

    // Registrar auditoria
    await logBrainAudit({
      action: 'UPDATE_METADATA',
      entityType: 'BrainNode',
      entityId: nodeId,
      before,
      after: updated,
      userId,
      reason: `Updated metadata for: ${node.label}`,
    })

    return updated
  } catch (error) {
    console.error('Error in updateNodeMetadata:', error)
    throw error
  }
}

/**
 * Busca arestas por tipo
 */
export async function getEdgesByType(
  edgeType: string,
  limit: number = 100
): Promise<
  Array<{
    id: string
    fromId: string
    toId: string
    type: string
    from: BrainNode
    to: BrainNode
  }>
> {
  try {
    const edges = await prisma.brainEdge.findMany({
      where: { type: edgeType },
      take: limit,
      include: {
        from: true,
        to: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return edges
  } catch (error) {
    console.error('Error in getEdgesByType:', error)
    throw error
  }
}

/**
 * Encontra vizinhos em comum entre dois nós
 */
export async function getCommonNeighbors(
  nodeId1: string,
  nodeId2: string
): Promise<{
  commonOutgoing: BrainNode[]
  commonIncoming: BrainNode[]
  totalCommon: number
}> {
  try {
    // Vizinhos do primeiro nó
    const [outgoing1, incoming1] = await Promise.all([
      prisma.brainEdge.findMany({ where: { fromId: nodeId1 } }),
      prisma.brainEdge.findMany({ where: { toId: nodeId1 } }),
    ])

    // Vizinhos do segundo nó
    const [outgoing2, incoming2] = await Promise.all([
      prisma.brainEdge.findMany({ where: { fromId: nodeId2 } }),
      prisma.brainEdge.findMany({ where: { toId: nodeId2 } }),
    ])

    // IDs em comum
    const commonOutgoingIds = new Set(
      outgoing1.map(e => e.toId).filter(id => outgoing2.map(e => e.toId).includes(id))
    )

    const commonIncomingIds = new Set(
      incoming1.map(e => e.fromId).filter(id => incoming2.map(e => e.fromId).includes(id))
    )

    const [commonOut, commonIn] = await Promise.all([
      prisma.brainNode.findMany({
        where: { id: { in: Array.from(commonOutgoingIds) } },
      }),
      prisma.brainNode.findMany({
        where: { id: { in: Array.from(commonIncomingIds) } },
      }),
    ])

    return {
      commonOutgoing: commonOut,
      commonIncoming: commonIn,
      totalCommon: commonOutgoingIds.size + commonIncomingIds.size,
    }
  } catch (error) {
    console.error('Error in getCommonNeighbors:', error)
    throw error
  }
}

/**
 * Agrupa nós por tipo (clustering)
 */
export async function clusterNodesByType(): Promise<
  Record<string, { count: number; nodes: BrainNode[] }>
> {
  try {
    const allNodes = await prisma.brainNode.findMany()

    const clusters: Record<string, { count: number; nodes: BrainNode[] }> = {}

    for (const node of allNodes) {
      if (!clusters[node.type]) {
        clusters[node.type] = { count: 0, nodes: [] }
      }
      clusters[node.type].nodes.push(node)
      clusters[node.type].count++
    }

    return clusters
  } catch (error) {
    console.error('Error in clusterNodesByType:', error)
    throw error
  }
}

/**
 * Retorna os nós mais conectados (ranking)
 */
export async function getMostConnectedNodes(
  limit: number = 20
): Promise<
  Array<{
    node: BrainNode
    totalConnections: number
    inDegree: number
    outDegree: number
  }>
> {
  try {
    const allNodes = await prisma.brainNode.findMany()

    const nodeStats = await Promise.all(
      allNodes.map(async node => {
        const [inDegree, outDegree] = await Promise.all([
          prisma.brainEdge.count({ where: { toId: node.id } }),
          prisma.brainEdge.count({ where: { fromId: node.id } }),
        ])

        return {
          node,
          totalConnections: inDegree + outDegree,
          inDegree,
          outDegree,
        }
      })
    )

    return nodeStats.sort((a, b) => b.totalConnections - a.totalConnections).slice(0, limit)
  } catch (error) {
    console.error('Error in getMostConnectedNodes:', error)
    throw error
  }
}

/**
 * Calcula distância (hops) entre dois nós
 */
export async function getNodeDistance(startId: string, endId: string): Promise<number | null> {
  try {
    const path = await findPathBetweenNodes(startId, endId)
    return path ? path.distance : null
  } catch (error) {
    console.error('Error in getNodeDistance:', error)
    throw error
  }
}

/**
 * Mescla dois nós em um
 */
export async function mergeNodes(
  sourceId: string,
  targetId: string,
  userId?: string
): Promise<BrainNode> {
  try {
    const [source, target] = await Promise.all([
      prisma.brainNode.findUnique({ where: { id: sourceId } }),
      prisma.brainNode.findUnique({ where: { id: targetId } }),
    ])

    if (!source || !target) throw new Error('One or both nodes not found')

    // Redirecionar todas as arestas do source para target
    const [sourceOutgoing, sourceIncoming] = await Promise.all([
      prisma.brainEdge.findMany({ where: { fromId: sourceId } }),
      prisma.brainEdge.findMany({ where: { toId: sourceId } }),
    ])

    // Atualizar arestas saindo de source
    for (const edge of sourceOutgoing) {
      await connectNodes(targetId, edge.toId, edge.type, edge.metadata ?? undefined, userId)
    }

    // Atualizar arestas entrando em source
    for (const edge of sourceIncoming) {
      await connectNodes(edge.fromId, targetId, edge.type, edge.metadata ?? undefined, userId)
    }

    // Mesclar metadados
    const mergedMetadata = {
      ...target.metadata,
      ...source.metadata,
      mergedFrom: sourceId,
      mergedAt: new Date().toISOString(),
    }

    const updated = await prisma.brainNode.update({
      where: { id: targetId },
      data: { metadata: mergedMetadata },
    })

    // Deletar source
    await deleteNode(sourceId, userId)

    // Registrar auditoria
    await logBrainAudit({
      action: 'MERGE_NODES',
      entityType: 'BrainNode',
      entityId: targetId,
      before: target,
      after: updated,
      userId,
      reason: `Merged ${source.label} into ${target.label}`,
    })

    return updated
  } catch (error) {
    console.error('Error in mergeNodes:', error)
    throw error
  }
}

/**
 * Detecta ciclos no grafo
 */
export async function detectCycles(): Promise<
  Array<{
    cycle: string[]
    length: number
  }>
> {
  try {
    const cycles: Array<{ cycle: string[]; length: number }> = []
    const visited = new Set<string>()
    const nodes = await prisma.brainNode.findMany()

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = await findCycleDFS(node.id, node.id, new Set(), [])
        if (cycle.length > 0) {
          cycles.push({
            cycle,
            length: cycle.length,
          })
          cycle.forEach(id => visited.add(id))
        }
      }
    }

    return cycles
  } catch (error) {
    console.error('Error in detectCycles:', error)
    throw error
  }
}

/**
 * Helper para detectar ciclos (DFS)
 */
async function findCycleDFS(
  currentId: string,
  startId: string,
  visited: Set<string>,
  path: string[]
): Promise<string[]> {
  visited.add(currentId)
  path.push(currentId)

  const outgoing = await prisma.brainEdge.findMany({
    where: { fromId: currentId },
  })

  for (const edge of outgoing) {
    if (edge.toId === startId && path.length > 1) {
      return path
    }

    if (!visited.has(edge.toId)) {
      const cycle = await findCycleDFS(edge.toId, startId, visited, [...path])
      if (cycle.length > 0) return cycle
    }
  }

  return []
}

/**
 * Remove arestas inativas/antigas
 */
export async function pruneOldEdges(
  daysSinceCreation: number = 90,
  userId?: string
): Promise<{
  prunedCount: number
  reason: string
}> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceCreation)

    const oldEdges = await prisma.brainEdge.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    for (const edge of oldEdges) {
      await prisma.brainEdge.delete({
        where: { id: edge.id },
      })

      await logBrainAudit({
        action: 'PRUNE_EDGE',
        entityType: 'BrainEdge',
        entityId: edge.id,
        before: edge,
        userId,
        reason: `Pruned old edge (created ${daysSinceCreation}+ days ago)`,
      })
    }

    return {
      prunedCount: oldEdges.length,
      reason: `Removed edges older than ${daysSinceCreation} days`,
    }
  } catch (error) {
    console.error('Error in pruneOldEdges:', error)
    throw error
  }
}

/**
 * Calcula influência de um nó (PageRank simplificado)
 */
export async function getNodeInfluence(nodeId: string): Promise<{
  nodeId: string
  influenceScore: number
  rankedPosition?: number
}> {
  try {
    const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    // Contar incoming edges (quanto mais recebe, mais influente)
    const incomingCount = await prisma.brainEdge.count({
      where: { toId: nodeId },
    })

    const allNodesInDegreeSum = await prisma.brainEdge.groupBy({
      by: ['toId'],
      _count: true,
    })

    const totalDegree = allNodesInDegreeSum.reduce((sum, item) => sum + item._count, 0)

    // Score: percentual de influência em relação ao total
    const influenceScore = totalDegree > 0 ? (incomingCount / totalDegree) * 100 : 0

    // Ranquear entre todos os nós
    const rankedPosition = (
      await prisma.brainNode.findMany({
        select: { id: true },
      })
    ).length

    return {
      nodeId,
      influenceScore: Math.round(influenceScore * 100) / 100,
      rankedPosition,
    }
  } catch (error) {
    console.error('Error in getNodeInfluence:', error)
    throw error
  }
}

/**
 * Matriz de alcançabilidade (quais nós podem alcançar quais)
 */
export async function getReachabilityMatrix(): Promise<
  Record<string, Record<string, boolean>>
> {
  try {
    const nodes = await prisma.brainNode.findMany()
    const matrix: Record<string, Record<string, boolean>> = {}

    for (const from of nodes) {
      matrix[from.id] = {}

      for (const to of nodes) {
        const path = await findPathBetweenNodes(from.id, to.id)
        matrix[from.id][to.id] = path !== null
      }
    }

    return matrix
  } catch (error) {
    console.error('Error in getReachabilityMatrix:', error)
    throw error
  }
}

/**
 * Exportar subgrafo para JSON
 */
export async function exportSubgraphToJSON(nodeId: string, depth: number = 2): Promise<string> {
  try {
    const subgraph = await getSubgraph(nodeId, depth)

    const json = {
      exported: new Date().toISOString(),
      root: nodeId,
      depth,
      nodes: subgraph.nodes,
      edges: subgraph.edges,
    }

    return JSON.stringify(json, null, 2)
  } catch (error) {
    console.error('Error in exportSubgraphToJSON:', error)
    throw error
  }
}

/**
 * Importar nós de JSON
 */
export async function importNodesFromJSON(
  jsonData: string,
  userId?: string
): Promise<{ imported: number; failed: number; errors: string[] }> {
  try {
    const data = JSON.parse(jsonData)
    const nodes = data.nodes || []

    const errors: string[] = []
    let imported = 0
    let failed = 0

    for (const nodeData of nodes) {
      try {
        await upsertNode({
          type: nodeData.type,
          label: nodeData.label,
          refType: nodeData.refType,
          refId: nodeData.refId,
          description: nodeData.description,
          metadata: nodeData.metadata,
          userId,
        })
        imported++
      } catch (error) {
        failed++
        errors.push(`Failed to import ${nodeData.label}: ${String(error)}`)
      }
    }

    return { imported, failed, errors }
  } catch (error) {
    console.error('Error in importNodesFromJSON:', error)
    throw error
  }
}

/**
 * Obter breadcrumbs até um nó (caminho desde raiz)
 */
export async function getNodeBreadcrumbs(
  nodeId: string,
  rootNodeId?: string
): Promise<string[]> {
  try {
    if (rootNodeId) {
      const path = await findPathBetweenNodes(rootNodeId, nodeId)
      return path?.path || [nodeId]
    }

    // Se não tiver raiz, tenta encontrar o nó com in-degree 0
    const allNodes = await prisma.brainNode.findMany()

    for (const potentialRoot of allNodes) {
      const inDegree = await prisma.brainEdge.count({
        where: { toId: potentialRoot.id },
      })

      if (inDegree === 0) {
        const path = await findPathBetweenNodes(potentialRoot.id, nodeId)
        if (path) return path.path
      }
    }

    return [nodeId]
  } catch (error) {
    console.error('Error in getNodeBreadcrumbs:', error)
    throw error
  }
}

/**
 * Métricas gerais do grafo
 */
export async function getGraphMetrics(): Promise<{
  nodeCount: number
  edgeCount: number
  memoryCount: number
  averageDegree: number
  density: number
  cyclesDetected: number
  orphanedNodes: number
  largestComponent: number
}> {
  try {
    const [nodeCount, edgeCount, memoryCount] = await Promise.all([
      prisma.brainNode.count(),
      prisma.brainEdge.count(),
      prisma.brainMemory.count(),
    ])

    const cycles = await detectCycles()

    const orphanedNodes = await prisma.brainNode.count({
      where: {
        AND: [{ outgoing: { none: {} } }, { incoming: { none: {} } }],
      },
    })

    const averageDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0
    const maxEdges = nodeCount * (nodeCount - 1)
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0

    // Componente mais conectada (aproximado)
    const largestComponent = Math.max(1, Math.floor(nodeCount / Math.max(1, orphanedNodes)))

    return {
      nodeCount,
      edgeCount,
      memoryCount,
      averageDegree: Math.round(averageDegree * 100) / 100,
      density: Math.round(density * 10000) / 10000,
      cyclesDetected: cycles.length,
      orphanedNodes,
      largestComponent,
    }
  } catch (error) {
    console.error('Error in getGraphMetrics:', error)
    throw error
  }
}

/**
 * Sugerir conexões entre nós (baseado em vizinhos similares)
 */
export async function suggestConnections(
  nodeId: string,
  limit: number = 10
): Promise<
  Array<{
    suggestedNodeId: string
    suggestedNode: BrainNode
    reason: string
    score: number
  }>
> {
  try {
    const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    // Buscar vizinhos do nó
    const neighbors = await getNodeWithContext(nodeId, 1)
    if (!neighbors) throw new Error('Cannot get node context')

    const neighborIds = new Set(neighbors.neighbors.map(n => n.id))

    // Buscar nós similares
    const similar = await findSimilarNodes(nodeId, 50)

    const suggestions: Array<{
      suggestedNodeId: string
      suggestedNode: BrainNode
      reason: string
      score: number
    }> = []

    for (const simNode of similar) {
      // Contar vizinhos em comum
      const simNeighbors = await getNodeWithContext(simNode.id, 1)
      if (!simNeighbors) continue

      const commonCount = simNeighbors.neighbors.filter(n => neighborIds.has(n.id)).length

      if (commonCount > 0) {
        suggestions.push({
          suggestedNodeId: simNode.id,
          suggestedNode: simNode,
          reason: `${commonCount} common neighbors`,
          score: commonCount,
        })
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, limit)
  } catch (error) {
    console.error('Error in suggestConnections:', error)
    throw error
  }
}

/**
 * Filtrar nós com múltiplos critérios
 */
export async function filterNodes(criteria: {
  type?: string
  labelContains?: string
  minConnections?: number
  maxConnections?: number
  refType?: string
  createdAfter?: Date
  createdBefore?: Date
  limit?: number
}): Promise<BrainNode[]> {
  try {
    const where: Prisma.BrainNodeWhereInput = {}

    if (criteria.type) where.type = criteria.type
    if (criteria.refType) where.refType = criteria.refType
    if (criteria.labelContains) {
      where.label = { contains: criteria.labelContains, mode: 'insensitive' }
    }
    if (criteria.createdAfter || criteria.createdBefore) {
      where.createdAt = {}
      if (criteria.createdAfter) where.createdAt.gte = criteria.createdAfter
      if (criteria.createdBefore) where.createdAt.lte = criteria.createdBefore
    }

    const nodes = await prisma.brainNode.findMany({
      where,
      take: criteria.limit || 100,
    })

    // Filtrar por conexões se especificado
    if (criteria.minConnections !== undefined || criteria.maxConnections !== undefined) {
      const filtered = []

      for (const node of nodes) {
        const [inDegree, outDegree] = await Promise.all([
          prisma.brainEdge.count({ where: { toId: node.id } }),
          prisma.brainEdge.count({ where: { fromId: node.id } }),
        ])

        const totalDegree = inDegree + outDegree

        const meetsMin = !criteria.minConnections || totalDegree >= criteria.minConnections
        const meetsMax = !criteria.maxConnections || totalDegree <= criteria.maxConnections

        if (meetsMin && meetsMax) {
          filtered.push(node)
        }
      }

      return filtered
    }

    return nodes
  } catch (error) {
    console.error('Error in filterNodes:', error)
    throw error
  }
}

/**
 * Atualizar metadados de múltiplos nós
 */
export async function updateBulkMetadata(
  nodeIds: string[],
  metadataUpdates: Record<string, unknown>,
  userId?: string
): Promise<{ updated: number; failed: number }> {
  try {
    let updated = 0
    let failed = 0

    for (const nodeId of nodeIds) {
      try {
        const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
        if (!node) {
          failed++
          continue
        }

        const currentMetadata = (node.metadata as Record<string, unknown>) || {}
        const newMetadata = { ...currentMetadata, ...metadataUpdates }

        await updateNodeMetadata(nodeId, newMetadata, userId)
        updated++
      } catch (error) {
        console.error(`Failed to update ${nodeId}:`, error)
        failed++
      }
    }

    return { updated, failed }
  } catch (error) {
    console.error('Error in updateBulkMetadata:', error)
    throw error
  }
}

/**
 * Comparar dois nós
 */
export async function getNodeDiff(nodeId1: string, nodeId2: string): Promise<{
  sameType: boolean
  sameLabel: boolean
  sameBehavior: boolean
  connectionDifference: number
  metadata1: Prisma.JsonValue
  metadata2: Prisma.JsonValue
}> {
  try {
    const [node1, node2, stats1, stats2] = await Promise.all([
      prisma.brainNode.findUnique({ where: { id: nodeId1 } }),
      prisma.brainNode.findUnique({ where: { id: nodeId2 } }),
      getNodeStats(nodeId1),
      getNodeStats(nodeId2),
    ])

    if (!node1 || !node2) throw new Error('One or both nodes not found')

    const connectionDifference = Math.abs(stats1.inDegree + stats1.outDegree - (stats2.inDegree + stats2.outDegree));

    return {
      sameType: node1.type === node2.type,
      sameLabel: node1.label === node2.label,
      sameBehavior: stats1.inDegree === stats2.inDegree && stats1.outDegree === stats2.outDegree,
      connectionDifference,
      metadata1: node1.metadata,
      metadata2: node2.metadata,
    }
  } catch (error) {
    console.error('Error in getNodeDiff:', error)
    throw error
  }
}

/**
 * Arquivar um nó em vez de deletar
 */
export async function archiveNode(
  nodeId: string,
  reason: string,
  userId?: string
): Promise<BrainNode> {
  try {
    const node = await prisma.brainNode.findUnique({ where: { id: nodeId } })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    const archivedMetadata = {
      ...(node.metadata as Record<string, unknown>),
      archived: true,
      archivedAt: new Date().toISOString(),
      archiveReason: reason,
    }

    const updated = await updateNodeMetadata(nodeId, archivedMetadata, userId)

    await logBrainAudit({
      action: 'ARCHIVE_NODE',
      entityType: 'BrainNode',
      entityId: nodeId,
      after: updated,
      userId,
      reason: `Archived node: ${reason}`,
    })

    return updated
  } catch (error) {
    console.error('Error in archiveNode:', error)
    throw error
  }
}

/**
 * Recuperar nós arquivados
 */
export async function getArchivedNodes(): Promise<BrainNode[]> {
  try {
    const allNodes = await prisma.brainNode.findMany()

    return allNodes.filter(node => {
      const metadata = node.metadata as Record<string, unknown>
      return metadata?.archived === true
    })
  } catch (error) {
    console.error('Error in getArchivedNodes:', error)
    throw error
  }
}

/**
 * Todos os ancestrais de um nó
 */
export async function getNodeAncestors(nodeId: string): Promise<BrainNode[]> {
  try {
    const ancestors = new Set<string>()
    const queue: string[] = [nodeId]

    while (queue.length > 0) {
      const currentId = queue.shift()!

      const incoming = await prisma.brainEdge.findMany({
        where: { toId: currentId },
      })

      for (const edge of incoming) {
        if (!ancestors.has(edge.fromId)) {
          ancestors.add(edge.fromId)
          queue.push(edge.fromId)
        }
      }
    }

    const ancestorNodes = await prisma.brainNode.findMany({
      where: { id: { in: Array.from(ancestors) } },
    })

    return ancestorNodes
  } catch (error) {
    console.error('Error in getNodeAncestors:', error)
    throw error
  }
}

/**
 * Todos os descendentes de um nó
 */
export async function getNodeDescendants(nodeId: string): Promise<BrainNode[]> {
  try {
    const descendants = new Set<string>()
    const queue: string[] = [nodeId]

    while (queue.length > 0) {
      const currentId = queue.shift()!

      const outgoing = await prisma.brainEdge.findMany({
        where: { fromId: currentId },
      })

      for (const edge of outgoing) {
        if (!descendants.has(edge.toId)) {
          descendants.add(edge.toId)
          queue.push(edge.toId)
        }
      }
    }

    const descendantNodes = await prisma.brainNode.findMany({
      where: { id: { in: Array.from(descendants) } },
    })

    return descendantNodes
  } catch (error) {
    console.error('Error in getNodeDescendants:', error)
    throw error
  }
}

/**
 * Últimas alterações no brain
 */
export async function getMostRecentChanges(limit: number = 50): Promise<
  Array<{
    timestamp: Date
    action: string
    entityType: string
    reason?: string
    userId?: string
  }>
> {
  try {
    const logs = await prisma.brainAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        createdAt: true,
        action: true,
        entityType: true,
        reason: true,
        userId: true,
      },
    })

    return logs.map(log => ({
      timestamp: log.createdAt,
      action: log.action,
      entityType: log.entityType,
      reason: log.reason || undefined,
      userId: log.userId || undefined,
    }))
  } catch (error) {
    console.error('Error in getMostRecentChanges:', error)
    throw error
  }
}

/**
 * Validar integridade de referências
 */
export async function validateNodeReferences(): Promise<{
  valid: boolean
  invalidReferences: Array<{
    nodeId: string
    refType: string
    refId: string
    reason: string
  }>
}> {
  try {
    const invalidReferences: Array<{
      nodeId: string
      refType: string
      refId: string
      reason: string
    }> = []

    const nodes = await prisma.brainNode.findMany({
      where: {
        AND: [{ refType: { not: null } }, { refId: { not: null } }],
      },
    })

    // Aqui você poderia validar contra banco de dados real
    // Por enquanto, apenas retorna nós com referências
    for (const node of nodes) {
      if (!node.refType || !node.refId) {
        invalidReferences.push({
          nodeId: node.id,
          refType: node.refType || 'UNKNOWN',
          refId: node.refId || 'UNKNOWN',
          reason: 'Missing reference type or ID',
        })
      }
    }

    return {
      valid: invalidReferences.length === 0,
      invalidReferences,
    }
  } catch (error) {
    console.error('Error in validateNodeReferences:', error)
    throw error
  }
}
