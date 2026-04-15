# EXAMPLES - Como usar o Brain no projeto

---

## Exemplo 1: API Route - Buscar contexto completo de uma empresa

```typescript
// pages/api/companies/[id]/brain.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getNodeWithContext, getNodeMemories, traceImpact } from '@/lib/brain'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  try {
    // 1. Buscar empresa real
    const company = await prisma.company.findUnique({ where: { id: id as string } })
    if (!company) return res.status(404).json({ error: 'Company not found' })

    // 2. Buscar nó do brain correspondente
    const brainNode = await prisma.brainNode.findFirst({
      where: { refType: 'Company', refId: id as string },
    })
    if (!brainNode) return res.status(404).json({ error: 'Brain node not found' })

    // 3. Recuperar contexto (nós vizinhos, arestas)
    const context = await getNodeWithContext(brainNode.id, 2)

    // 4. Recuperar memórias associadas
    const memories = await getNodeMemories(brainNode.id)

    // 5. Traçar impacto (o que esta empresa afeta)
    const impact = await traceImpact(brainNode.id, 2)

    res.status(200).json({
      company,
      brainNode,
      context,
      memories,
      impact,
    })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
}
```

---

## Exemplo 2: API Route - Sincronizar brain manualmente

```typescript
// pages/api/admin/brain/sync.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { syncBrain } from '@/scripts/sync-brain'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Proteger com auth
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await syncBrain()
    res.status(200).json({
      success: true,
      message: 'Brain sync completed',
      result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    })
  }
}
```

---

## Exemplo 3: Hook React - Usar brain em componente

```typescript
// hooks/useBrainContext.ts
import { useState, useEffect } from 'react'
import { getNodeWithContext } from '@/lib/brain'

export function useBrainContext(nodeId: string) {
  const [context, setContext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nodeId) return

    setLoading(true)
    getNodeWithContext(nodeId, 2)
      .then(setContext)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [nodeId])

  return { context, loading, error }
}
```

```typescript
// components/CompanyDetail.tsx
export function CompanyDetail({ companyId }: { companyId: string }) {
  const brainNodeId = companyId // Assumindo que ID é o mesmo

  const { context, loading, error } = useBrainContext(brainNodeId)

  if (loading) return <div>Loading brain context...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h2>{context?.node.label}</h2>
      <div>
        <h3>Connected Applications:</h3>
        {context?.neighbors.map(neighbor => (
          <div key={neighbor.id}>{neighbor.label}</div>
        ))}
      </div>
    </div>
  )
}
```

---

## Exemplo 4: Service - Manipular brain em lógica de negócio

```typescript
// services/brain.service.ts
import {
  upsertNode,
  connectNodes,
  addMemory,
  getSubgraph,
} from '@/lib/brain'

export const BrainService = {
  async onTicketCreated(ticketId: string, companyId: string, createdBy: string) {
    const ticketNode = await upsertNode({
      type: 'Ticket',
      label: `Ticket ${ticketId.slice(0, 8)}`,
      refType: 'Ticket',
      refId: ticketId,
      userId: createdBy,
    })
    const companyNode = await prisma.brainNode.findFirst({
      where: { refType: 'Company', refId: companyId },
    })
    if (companyNode) {
      await connectNodes(ticketNode.id, companyNode.id, 'BELONGS_TO')
    }
    const userNode = await prisma.brainNode.findFirst({
      where: { refType: 'User', refId: createdBy },
    })
    if (userNode) {
      await connectNodes(ticketNode.id, userNode.id, 'CREATED_BY')
    }
  },
  async onDefectFound(defectId: string, screenId: string, severity: string) {
    const screenNode = await prisma.brainNode.findFirst({
      where: { refType: 'Screen', refId: screenId },
    })
    if (screenNode) {
      await addMemory({
        title: `Defect: ${severity} issue found on screen`,
        summary: `A ${severity} severity defect was found on this screen. Monitor for reoccurrence.`,
        memoryType: 'EXCEPTION',
        importance: severity === 'CRITICAL' ? 5 : severity === 'HIGH' ? 4 : 2,
        relatedNodeIds: [screenNode.id],
        sourceType: 'DEFECT',
        sourceId: defectId,
      })
    }
  },
  async analyzeDefectDensity() {
    const moduleNodes = await prisma.brainNode.findMany({
      where: { type: 'Module' },
    })
    const analysis = []
    for (const module of moduleNodes) {
      const subgraph = await getSubgraph(module.id, 2)
      const defectCount = subgraph.nodes.filter(n => n.type === 'Defect').length
      analysis.push({
        module: module.label,
        defectCount,
        density: defectCount / Math.max(subgraph.nodes.length, 1),
      })
    }
    return analysis.sort((a, b) => b.density - a.density)
  },
  async analyzeChangeImpact(moduleId: string) {
    const moduleNode = await prisma.brainNode.findFirst({
      where: { refType: 'Module', refId: moduleId },
    })
    if (!moduleNode) return null
    const subgraph = await getSubgraph(moduleNode.id, 3)
    const impactByType: Record<string, number> = {}
    subgraph.nodes.forEach(node => {
      impactByType[node.type] = (impactByType[node.type] || 0) + 1
    })
    return {
      module: moduleNode.label,
      totalImpactedNodes: subgraph.nodes.length,
      edges: subgraph.edges.length,
      breakdown: impactByType,
    }
  },
}
```

---

## Exemplo 5: Integração com API de IA (Claude)

```typescript
// services/ai-with-brain.ts
import Anthropic from '@anthropic-ai/sdk'
import { getSubgraph, getNodeMemories, searchNodes } from '@/lib/brain'

export async function askAIWithBrainContext(
  question: string,
  companyId: string
) {
  const companyNode = await searchNodes('Company', companyId)
  if (companyNode.length === 0) {
    throw new Error('Company not found in brain')
  }
  const nodeId = companyNode[0].id
  const subgraph = await getSubgraph(nodeId, 2)
  const memories = await getNodeMemories(nodeId)
  const contextText = `
## Company Structure
- Node: ${companyNode[0].label}
- Related applications: ${subgraph.nodes.filter(n => n.type === 'Application').map(n => n.label).join(', ')}
- Related modules: ${subgraph.nodes.filter(n => n.type === 'Module').map(n => n.label).join(', ')}

## Brain Memories
${memories.map(m => `- ${m.title}: ${m.summary}`).join('\n')}
`
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: `You are a QA expert assistant with knowledge of this company's structure and history.
    \n${contextText}\nUse this information to answer questions accurately.`,
    messages: [
      {
        role: 'user',
        content: question,
      },
    ],
  })
  return response.content[0].type === 'text' ? response.content[0].text : null
}
```

---

## Exemplo 6: Middleware - Auto-sync após operações críticas

```typescript
// middleware/sync-brain-middleware.ts
export async function syncBrainAfterTicketUpdate(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return
  await upsertNode({
    type: 'Ticket',
    label: `#${ticketId.slice(0, 8)} - ${ticket.title}`,
    refType: 'Ticket',
    refId: ticketId,
    metadata: {
      status: ticket.status,
      priority: ticket.priority,
      updatedAt: new Date(),
    },
  })
}
```

```typescript
// pages/api/tickets/[id].ts
export default async function handler(req, res) {
  const { id } = req.query
  if (req.method === 'PUT') {
    const updated = await prisma.ticket.update({
      where: { id: id as string },
      data: req.body,
    })
    await syncBrainAfterTicketUpdate(id as string)
    res.json(updated)
  }
}
```

---

## Exemplo 7: Dashboard - Visualizar estatísticas do brain

```typescript
// components/BrainStats.tsx
import { useEffect, useState } from 'react'
import { validateBrainIntegrity } from '@/lib/brain'

export function BrainStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    validateBrainIntegrity()
      .then(validation => setStats(validation.stats))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
      <h3>Brain Statistics</h3>
      <div>Total Nodes: <strong>{stats?.nodes}</strong></div>
      <div>Total Edges: <strong>{stats?.edges}</strong></div>
      <div>Total Memories: <strong>{stats?.memories}</strong></div>
    </div>
  )
}
```

---

---

## Exemplo 8: Deletar nó e suas conexões

```typescript
import { deleteNode } from '@/lib/brain'

// Deletar um nó (remove também todas as arestas conectadas)
const result = await deleteNode('node-id-123', userId)
console.log(`Deleted node with ${result.deletedEdges} edges`)
```

---

## Exemplo 9: Desconectar dois nós

```typescript
import { disconnectNodes } from '@/lib/brain'

// Remover aresta específica entre dois nós
const success = await disconnectNodes('node-1', 'node-2', 'RELATED_TO', userId)
if (success) {
  console.log('Edge removed successfully')
}
```

---

## Exemplo 10: Encontrar caminho entre nós

```typescript
import { findPathBetweenNodes } from '@/lib/brain'

// Encontrar o caminho mais curto entre dois nós
const path = await findPathBetweenNodes('company-1', 'defect-50')
if (path) {
  console.log(`Found path: ${path.path.join(' -> ')}`)
  console.log(`Distance: ${path.distance}`)
  // Exemplo: ['company-1'] -> ['module-10'] -> ['feature-5'] -> ['defect-50']
}
```

---

## Exemplo 11: Obter memórias relacionadas

```typescript
import { getRelatedMemories } from '@/lib/brain'

// Buscar todas as memórias conectadas a um nó até profundidade 3
const memories = await getRelatedMemories('company-id', 3)
memories.forEach(memory => {
  console.log(`${memory.title}: ${memory.summary}`)
})
```

---

## Exemplo 12: Calcular importância de um nó

```typescript
import { computeNodeImportance } from '@/lib/brain'

// Calcular importância baseada em grau de conexão
const importance = await computeNodeImportance('node-id')
console.log(`In-degree: ${importance.inDegree}`)
console.log(`Out-degree: ${importance.outDegree}`)
console.log(`Importance score: ${importance.importance.toFixed(2)}`) // 0-1
```

---

## Exemplo 13: Estatísticas de um nó

```typescript
import { getNodeStats } from '@/lib/brain'

// Obter todas as estatísticas de um nó
const stats = await getNodeStats('node-id')
console.log(`
  Node: ${stats.label} (${stats.type})
  In-connections: ${stats.inDegree}
  Out-connections: ${stats.outDegree}
  Memories: ${stats.memoryCount}
  Importance: ${stats.importance.toFixed(3)}
  Created: ${stats.createdAt}
`)
```

---

## Exemplo 14: Criar múltiplos nós em batch

```typescript
import { bulkUpsertNodes } from '@/lib/brain'

// Criar vários nós de uma vez
const nodes = await bulkUpsertNodes([
  {
    type: 'Module',
    label: 'Auth Module',
    refType: 'Module',
    refId: 'mod-1',
    description: 'Authentication and authorization'
  },
  {
    type: 'Module',
    label: 'Payment Module',
    refType: 'Module',
    refId: 'mod-2',
    description: 'Payment processing'
  },
  {
    type: 'Module',
    label: 'Reporting Module',
    refType: 'Module',
    refId: 'mod-3',
    description: 'Report generation'
  }
], userId)

console.log(`Created ${nodes.length} nodes`)
```

---

## Exemplo 15: Encontrar nós similares

```typescript
import { findSimilarNodes } from '@/lib/brain'

// Encontrar todos os defects similares (mesmo tipo)
const similarDefects = await findSimilarNodes('defect-1', 20)
console.log(`Found ${similarDefects.length} similar defects`)

similarDefects.forEach(defect => {
  console.log(`- ${defect.label}`)
})
```

---

## Exemplo 16: Obter histórico (timeline) de um nó

```typescript
import { getNodeTimeline } from '@/lib/brain'

// Ver todas as mudanças de um nó
const timeline = await getNodeTimeline('node-id')
timeline.forEach(entry => {
  console.log(`[${entry.timestamp}] ${entry.action}: ${entry.reason}`)
  console.log(`  Before: ${JSON.stringify(entry.before)}`)
  console.log(`  After: ${JSON.stringify(entry.after)}`)
})
```

---

## Exemplo 17: Análise completa com novas funções

```typescript
import {
  getNodeStats,
  computeNodeImportance,
  getNodeMemories,
  getRelatedMemories,
  findSimilarNodes,
  getNodeTimeline,
} from '@/lib/brain'

export async function analyzeNode(nodeId: string) {
  // 1. Estatísticas base
  const stats = await getNodeStats(nodeId)
  
  // 2. Importância computada
  const importance = await computeNodeImportance(nodeId)
  
  // 3. Memórias diretas
  const directMemories = await getNodeMemories(nodeId)
  
  // 4. Memórias relacionadas (incluindo vizinhos)
  const relatedMemories = await getRelatedMemories(nodeId, 2)
  
  // 5. Nós similares
  const similar = await findSimilarNodes(nodeId, 5)
  
  // 6. Histórico de mudanças
  const history = await getNodeTimeline(nodeId)

  return {
    node: {
      id: nodeId,
      label: stats.label,
      type: stats.type,
    },
    connections: {
      inDegree: stats.inDegree,
      outDegree: stats.outDegree,
      importance: importance.importance.toFixed(3),
    },
    knowledge: {
      directMemories: directMemories.length,
      relatedMemories: relatedMemories.length,
    },
    discovery: {
      similarNodes: similar.length,
      changes: history.length,
    },
  }
}

// Usar:
const analysis = await analyzeNode('company-1')
console.log(JSON.stringify(analysis, null, 2))
```

---

---

## Exemplo 18: Buscar nós por metadados

```typescript
import { getNodesByMetadata } from '@/lib/brain'

// Encontrar todos os nós com status "CRITICAL"
const criticalNodes = await getNodesByMetadata(
  { status: 'CRITICAL' },
  100
)

console.log(`Found ${criticalNodes.length} critical nodes`)
```

---

## Exemplo 19: Atualizar metadados de um nó

```typescript
import { updateNodeMetadata } from '@/lib/brain'

// Atualizar apenas os metadados (não afeta label ou description)
const updated = await updateNodeMetadata(
  'node-id',
  {
    status: 'RESOLVED',
    resolvedBy: 'user-123',
    resolvedAt: new Date().toISOString(),
  },
  userId
)
```

---

## Exemplo 20: Buscar arestas por tipo

```typescript
import { getEdgesByType } from '@/lib/brain'

// Encontrar todas as arestas do tipo "DEPENDS_ON"
const dependencies = await getEdgesByType('DEPENDS_ON', 50)

dependencies.forEach(edge => {
  console.log(`${edge.from.label} DEPENDS_ON ${edge.to.label}`)
})
```

---

## Exemplo 21: Encontrar vizinhos em comum

```typescript
import { getCommonNeighbors } from '@/lib/brain'

// Quais nós conectam module-1 e module-2?
const common = await getCommonNeighbors('module-1', 'module-2')

console.log(`Outgoing neighbors: ${common.commonOutgoing.map(n => n.label).join(', ')}`)
console.log(`Incoming neighbors: ${common.commonIncoming.map(n => n.label).join(', ')}`)
console.log(`Total common: ${common.totalCommon}`)
```

---

## Exemplo 22: Agrupar nós por tipo

```typescript
import { clusterNodesByType } from '@/lib/brain'

// Agrupar todos os nós
const clusters = await clusterNodesByType()

Object.entries(clusters).forEach(([type, cluster]) => {
  console.log(`${type}: ${cluster.count} nodes`)
  cluster.nodes.forEach(node => console.log(`  - ${node.label}`))
})
```

---

## Exemplo 23: Nós mais conectados

```typescript
import { getMostConnectedNodes } from '@/lib/brain'

// Top 10 nós mais conectados
const topNodes = await getMostConnectedNodes(10)

topNodes.forEach((item, index) => {
  console.log(`${index + 1}. ${item.node.label}`)
  console.log(`   Conexões: ${item.totalConnections} (in: ${item.inDegree}, out: ${item.outDegree})`)
})
```

---

## Exemplo 24: Distância entre nós

```typescript
import { getNodeDistance } from '@/lib/brain'

// Quantos passos de um ticket até uma empresa?
const distance = await getNodeDistance('ticket-1', 'company-1')

if (distance !== null) {
  console.log(`Distância: ${distance} hops`)
} else {
  console.log('Nenhum caminho encontrado')
}
```

---

## Exemplo 25: Mesclar dois nós

```typescript
import { mergeNodes } from '@/lib/brain'

// Mesclar dois nós duplicados
const merged = await mergeNodes('old-node-id', 'new-node-id', userId)

console.log(`Nós mesclados em: ${merged.label}`)
console.log(`Metadados: ${JSON.stringify(merged.metadata)}`)
```

---

## Exemplo 26: Detectar ciclos

```typescript
import { detectCycles } from '@/lib/brain'

// Encontrar ciclos no grafo
const cycles = await detectCycles()

cycles.forEach((cycle, index) => {
  console.log(`Ciclo ${index + 1} (tamanho ${cycle.length}):`)
  console.log(`  ${cycle.cycle.join(' -> ')}`)
})

if (cycles.length === 0) {
  console.log('Grafo é um DAG (sem ciclos)')
}
```

---

## Exemplo 27: Limpar arestas antigas

```typescript
import { pruneOldEdges } from '@/lib/brain'

// Remover arestas criadas há mais de 6 meses
const result = await pruneOldEdges(180, userId)

console.log(`${result.prunedCount} edges removidas`)
console.log(`Motivo: ${result.reason}`)
```

---

## Exemplo 28: Calcular influência de um nó

```typescript
import { getNodeInfluence } from '@/lib/brain'

// Influência de um nó (PageRank simplificado)
const influence = await getNodeInfluence('company-1')

console.log(`Nó: ${'company-1'}`)
console.log(`Score de influência: ${influence.influenceScore}%`)
console.log(`Posição no ranking: #${influence.rankedPosition}`)
```

---

## Exemplo 29: Matriz de alcançabilidade

```typescript
import { getReachabilityMatrix } from '@/lib/brain'

// Quais nós conseguem alcançar quais?
const matrix = await getReachabilityMatrix()

// Exemplo de uso:
const canReach = matrix['node-1']['node-2'] // true ou false
console.log(`node-1 pode alcançar node-2? ${canReach}`)

// Encontrar todos os nós que node-1 consegue alcançar
const reachable = Object.entries(matrix['node-1'])
  .filter(([_, canReach]) => canReach)
  .map(([nodeId, _]) => nodeId)

console.log(`${reachable.length} nós alcançáveis de node-1`)
```

---

## Exemplo 30: Dashboard Avançado com todas as funções

```typescript
import {
  getNodeStats,
  getMostConnectedNodes,
  clusterNodesByType,
  detectCycles,
  getNodeInfluence,
  validateBrainIntegrity,
} from '@/lib/brain'

export async function getBrainDashboard() {
  const [stats, topNodes, clusters, cycles, validation] = await Promise.all([
    // ... stats for a specific node
    Promise.all([
      getMostConnectedNodes(),
      clusterNodesByType(),
      detectCycles(),
      validateBrainIntegrity(),
    ]).then(([tops, clust, cyc, valid]) => ({ tops, clust, cyc, valid })),
  ])

  return {
    overview: {
      totalNodes: validation.stats.nodes,
      totalEdges: validation.stats.edges,
      totalMemories: validation.stats.memories,
      healthy: validation.valid,
      issues: validation.errors,
    },
    topology: {
      cyclesDetected: cycles.length,
      clusters: Object.keys(clusters).length,
      clusterBreakdown: Object.fromEntries(
        Object.entries(clusters).map(([type, cluster]) => [type, cluster.count])
      ),
    },
    influence: {
      topNodes: topNodes.map(item => ({
        label: item.node.label,
        connections: item.totalConnections,
        influence: ((item.totalConnections / validation.stats.edges) * 100).toFixed(2),
      })),
    },
  }
}

// Usar:
const dashboard = await getBrainDashboard()
console.log(JSON.stringify(dashboard, null, 2))
```

---

---

## Exemplo 31: Exportar subgrafo para JSON

```typescript
import { exportSubgraphToJSON } from '@/lib/brain'

// Exportar um subgrafo completo
const json = await exportSubgraphToJSON('company-1', 2)

// Salvar em arquivo ou enviar para integração
fs.writeFileSync('company-graph.json', json)
console.log('Grafo exportado!')
```

---

## Exemplo 32: Importar nós de JSON

```typescript
import { importNodesFromJSON } from '@/lib/brain'
import * as fs from 'fs'

// Importar nós de um arquivo JSON
const jsonContent = fs.readFileSync('nodes-import.json', 'utf-8')
const result = await importNodesFromJSON(jsonContent, userId)

console.log(`Importados: ${result.imported}, Falhados: ${result.failed}`)
result.errors.forEach(err => console.log(`  ❌ ${err}`))
```

---

## Exemplo 33: Obter breadcrumbs (por onde chegar)

```typescript
import { getNodeBreadcrumbs } from '@/lib/brain'

// Caminho até um nó (breadcrumbs para navegação)
const path = await getNodeBreadcrumbs('defect-123')
console.log(`Caminho: ${path.join(' > ')}`)
// Resultado: ['company-1', 'project-5', 'module-2', 'defect-123']
```

---

## Exemplo 34: Métricas gerais do grafo

```typescript
import { getGraphMetrics } from '@/lib/brain'

// Obter estatísticas completas do grafo
const metrics = await getGraphMetrics()

console.log(`
📊 Grafo Knowledge
- Nós: ${metrics.nodeCount}
- Arestas: ${metrics.edgeCount}
- Memórias: ${metrics.memoryCount}
- Grau médio: ${metrics.averageDegree}
- Densidade: ${metrics.density}
- Ciclos detectados: ${metrics.cyclesDetected}
- Nós órfãos: ${metrics.orphanedNodes}
- Maior componente: ${metrics.largestComponent}
`)
```

---

## Exemplo 35: Sugerir conexões

```typescript
import { suggestConnections } from '@/lib/brain'

// Sugerir novos relacionamentos para um nó
const suggestions = await suggestConnections('module-1', 5)

suggestions.forEach(suggestion => {
  console.log(`Sugerir conexão com: ${suggestion.suggestedNode.label}`)
  console.log(`  Razão: ${suggestion.reason}`)
  console.log(`  Score: ${suggestion.score}`)
})
```

---

## Exemplo 36: Filtrar nós com critérios múltiplos

```typescript
import { filterNodes } from '@/lib/brain'

// Encontrar todos os defects críticos criados no último mês
const criticalDefects = await filterNodes({
  type: 'Defect',
  labelContains: 'CRITICAL',
  minConnections: 2,
  createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  limit: 50,
})

console.log(`Encontrados ${criticalDefects.length} defects críticos`)
```

---

## Exemplo 37: Atualizar metadados em massa

```typescript
import { updateBulkMetadata } from '@/lib/brain'

// Marcar múltiplos nós como resolvidos
const nodeIds = ['defect-1', 'defect-2', 'defect-3']
const result = await updateBulkMetadata(
  nodeIds,
  {
    status: 'RESOLVED',
    resolvedAt: new Date().toISOString(),
    resolvedBy: 'user-123',
  },
  userId
)

console.log(`✅ Atualizados: ${result.updated}, ❌ Falhados: ${result.failed}`)
```

---

## Exemplo 38: Comparar dois nós

```typescript
import { getNodeDiff } from '@/lib/brain'

// Encontrar diferenças entre dois nós
const diff = await getNodeDiff('defect-1', 'defect-2')

console.log(`
Comparação:
- Mesmo tipo? ${diff.sameType}
- Mesmo label? ${diff.sameLabel}
- Mesmo padrão? ${diff.sameBehavior}
- Diferença de conexões: ${diff.connectionDifference}
`)

// Pode ser útil para encontrar duplicatas!
```

---

## Exemplo 39: Arquivar nó

```typescript
import { archiveNode } from '@/lib/brain'

// Arquivar em vez de deletar (melhor para auditoria)
const archived = await archiveNode(
  'old-defect-123',
  'Resolvido em produção - deprecado',
  userId
)

console.log(`Arquivado: ${archived.label}`)
```

---

## Exemplo 40: Recuperar nós arquivados

```typescript
import { getArchivedNodes } from '@/lib/brain'

// Ver histórico de nós arquivados
const archived = await getArchivedNodes()

archived.forEach(node => {
  const meta = node.metadata as Record<string, any>
  console.log(`${node.label} - Razão: ${meta.archiveReason}`)
})
```

---

## Exemplo 41: Todos os ancestrais

```typescript
import { getNodeAncestors } from '@/lib/brain'

// Rastrear origem de um nó
const ancestors = await getNodeAncestors('defect-123')

console.log('Ancestrais encontrados:')
ancestors.forEach(ancestor => {
  console.log(`  ↑ ${ancestor.label} (${ancestor.type})`)
})
```

---

## Exemplo 42: Todos os descendentes

```typescript
import { getNodeDescendants } from '@/lib/brain'

// Ver impacto de uma mudança
const descendants = await getNodeDescendants('module-1')

console.log(`${descendants.length} nós são afetados por mudanças em module-1`)
descendants.forEach(d => console.log(`  ↓ ${d.label}`))
```

---

## Exemplo 43: Últimas alterações

```typescript
import { getMostRecentChanges } from '@/lib/brain'

// Feed de atividades do brain
const recent = await getMostRecentChanges(20)

recent.forEach(change => {
  console.log(`
  [${change.timestamp.toLocaleString()}] ${change.action}
  Tipo: ${change.entityType}
  Motivo: ${change.reason}
  Por: ${change.userId}
  `)
})
```

---

## Exemplo 44: Validar integridade de referências

```typescript
import { validateNodeReferences } from '@/lib/brain'

// Verificar se todas as referências externas são válidas
const validation = await validateNodeReferences()

if (!validation.valid) {
  console.log('❌ Referências inválidas encontradas:')
  validation.invalidReferences.forEach(ref => {
    console.log(`  ${ref.nodeId}: ${ref.reason}`)
  })
} else {
  console.log('✅ Todas as referências são válidas!')
}
```

---

## Exemplo 45: Super Dashboard com todas as funções

```typescript
import {
  getGraphMetrics,
  getMostConnectedNodes,
  getArchivedNodes,
  getMostRecentChanges,
  validateNodeReferences,
  getNodeAncestors,
  detectCycles,
} from '@/lib/brain'

export async function getComprehensiveBrainReport() {
  const [metrics, topNodes, archived, recent, refValidation, cycles] = await Promise.all([
    getGraphMetrics(),
    getMostConnectedNodes(10),
    getArchivedNodes(),
    getMostRecentChanges(10),
    validateNodeReferences(),
    detectCycles(),
  ])

  return {
    health: {
      healthy: refValidation.valid && cycles.length === 0,
      cyclesFound: cycles.length,
      invalidReferences: refValidation.invalidReferences.length,
      archivedNodes: archived.length,
    },
    statistics: metrics,
    topInfluencers: topNodes.map(item => ({
      name: item.node.label,
      connections: item.totalConnections,
    })),
    recentActivity: recent.slice(0, 5).map(change => ({
      time: change.timestamp,
      action: change.action,
      type: change.entityType,
    })),
    recommendations: {
      archiveUnused: archived.length > 100 ? 'Consider cleanup' : 'OK',
      cycles: cycles.length > 0 ? 'Review circular dependencies' : 'OK',
      density: metrics.density < 0.01 ? 'Grafo é muito esparso' : 'OK',
    },
  }
}

// Usar em dashboard
const report = await getComprehensiveBrainReport()
console.log(JSON.stringify(report, null, 2))
```

---

Agora você tem **30+ funções avançadas** para o Brain! 🚀✨
