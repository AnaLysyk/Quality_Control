// ⚡ QUICK START - 5 MINUTOS

## 🎯 O que você vai ter em 5 minutos

Um **cérebro funcional** que:
- ✅ Mapeia toda sua base de dados (empresas, apps, módulos, telas, tickets, etc)
- ✅ Conecta entidades com relacionamentos reais
- ✅ Armazena memória persistente (decisões, regras, contexto)
- ✅ Permite consultas de impacto e contexto
- ✅ É auditado (rastreia quem mexeu em quê)

---

## 📦 Arquivos para copiar (na ordem)

```
1. schema-brain.prisma        → Final do seu schema.prisma
2. lib-brain.ts               → lib/brain.ts
3. scripts-sync-brain.ts      → scripts/sync-brain.ts
4. __tests__-brain.test.ts    → __tests__/brain.test.ts
```

---

## 🚀 5 COMANDOS (execute na ordem)

### 1. Integrar schema
```bash
# Abra prisma/schema.prisma
# Adicione o conteúdo de schema-brain.prisma ao final
# Salve
```

### 2. Criar tabelas
```bash
npx prisma migrate dev --name add_brain_models
# Escolha um nome, ex: "add_brain_models"
```

### 3. Atualizar Prisma
```bash
npx prisma generate
```

### 4. Popular brain
```bash
# Adicione ao package.json:
# "sync:brain": "ts-node scripts/sync-brain.ts"

npm run sync:brain
```

**Esperado:**
```
[SYNC] ===== STARTING BRAIN SYNC =====
[SYNC] Step 1: Creating nodes from entities...
[SYNC] Created X Company nodes
[SYNC] Created X Application nodes
[SYNC] ✓ Total nodes created: 1250
[SYNC] ✓ Total edges created: 3400
[SYNC] ===== SYNC COMPLETED in 3245ms =====
```

### 5. Testar tudo
```bash
npm run test:brain
# ou
npx jest __tests__/brain.test.ts
```

**Esperado:**
```
 PASS  __tests__/brain.test.ts
  ✓ 20 tests passed
```

---

## ✅ Pronto! Agora você tem:

### API Disponível (import direto):
```typescript
import {
  upsertNode,
  connectNodes,
  addMemory,
  getNodeWithContext,
  getNodeMemories,
  traceImpact,
  getSubgraph,
} from '@/lib/brain'
```

### Exemplo básico:
```typescript
// 1. Buscar contexto de uma empresa
const context = await getNodeWithContext('company-node-id')
console.log(context.node)
console.log(context.neighbors) // Apps conectadas
console.log(context.outgoing)   // Arestas saindo

// 2. Adicionar memória
await addMemory({
  title: 'Decision: use JWT',
  summary: 'Decided to use JWT tokens',
  memoryType: 'DECISION',
  importance: 5,
  relatedNodeIds: ['module-node-id'],
})

// 3. Traçar impacto
const impact = await traceImpact('module-node-id')
console.log(impact.impactedNodes) // O que é afetado
```

---

## 🔌 Integrar em uma API (exemplo)

```typescript
// pages/api/company/[id]/brain.ts
import { getNodeWithContext, getNodeMemories } from '@/lib/brain'

export default async function handler(req, res) {
  const { id } = req.query
  
  // Buscar nó do brain
  const brainNode = await prisma.brainNode.findFirst({
    where: { refType: 'Company', refId: id },
  })
  
  if (!brainNode) return res.status(404).json({})
  
  // Recuperar contexto e memórias
  const context = await getNodeWithContext(brainNode.id, 2)
  const memories = await getNodeMemories(brainNode.id)
  
  res.json({ context, memories })
}

// GET /api/company/company-123/brain
// Response:
// {
//   context: { node, outgoing, incoming, neighbors },
//   memories: [ { title, summary, importance, ... } ]
// }
```

---

## 🛠️ Troubleshooting rápido

**Erro: "Relation BrainNode does not exist"**
```bash
npx prisma migrate dev
# Migração não foi aplicada
```

**Erro: "Cannot find module @/lib/brain"**
```bash
# Verifique tsconfig.json:
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```

**Sync muito lento?**
```bash
node --max-old-space-size=4096 -r ts-node/register scripts/sync-brain.ts
```

---

## 📊 Status do brain

```bash
# Criar endpoint de status
# pages/api/brain/status.ts

import { validateBrainIntegrity } from '@/lib/brain'

export default async function handler(req, res) {
  const validation = await validateBrainIntegrity()
  res.json(validation)
}

# Chamar:
curl http://localhost:3000/api/brain/status

# Response esperada:
{
  "valid": true,
  "errors": [],
  "stats": {
    "nodes": 1250,
    "edges": 3400,
    "memories": 45
  }
}
```

---

## 🎯 Próximos passos

- ✅ **Agora:** Você tem FASE 1 (Brain Foundation)
- ⏭️ **FASE 2:** Endpoints REST otimizados
- ⏭️ **FASE 3:** Visualização interativa (React Flow)
- ⏭️ **FASE 4:** IA consultando o brain automaticamente
- ⏭️ **FASE 5:** Automações inteligentes

---

## 📋 Checklist final

- [ ] Schema integrado em prisma/schema.prisma
- [ ] `npx prisma migrate dev` executado
- [ ] `npm run sync:brain` completado com sucesso
- [ ] Testes passando (`npm run test:brain`)
- [ ] Funções do brain importáveis e testadas
- [ ] API de status criada e respondendo

**Se todos ✓, FASE 1 está pronta!**

---

## 💡 O que o brain está fazendo por você AGORA

1. **Mapeamento vivo**
   - Company → Application → Module → Screen
   - Relações reais entre entidades
   - Histórico auditado

2. **Memória persistente**
   - Decisões guardadas
   - Regras de negócio documentadas
   - Contexto técnico salvo

3. **Consultas estruturais**
   - "Que apps tem esta empresa?"
   - "Que telas estão neste módulo?"
   - "O que é afetado por esta mudança?"

4. **Inteligência preparada**
   - APIs prontas pra IA consultar
   - Contexto estruturado pra responder melhor
   - Memória que não se perde

---

## 🚀 Está tudo pronto!

Próximo: me chama quando quiser **FASE 2 (API Query + Performance)**

Qualquer dúvida, volta aqui!
