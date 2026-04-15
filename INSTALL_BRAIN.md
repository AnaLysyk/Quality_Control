# INSTALLATION GUIDE - FASE 1: Brain Foundation

## 📋 Pré-requisitos

- Next.js 13+ com TypeScript
- Prisma 4.0+
- PostgreSQL 12+
- Node.js 16+

---

## 🚀 PASSO A PASSO

### 1️⃣ Copiar arquivos

**A. Schema Prisma**
```bash
# Abra seu arquivo prisma/schema.prisma
# Adicione ao final (ou combine com models existentes):
```

**Copie o conteúdo do arquivo `schema-brain.prisma` para o final de `prisma/schema.prisma`**

Exemplo:
```prisma
// ... models existentes ...

// ============================================
// BRAIN MODELS - Grafo de Conhecimento
// ============================================
// [Copie aqui o conteúdo de schema-brain.prisma]
```

**B. Funções do Brain**
```bash
cp lib-brain.ts ./lib/brain.ts
```

**C. Script de Sincronização**
```bash
mkdir -p scripts
cp scripts-sync-brain.ts ./scripts/sync-brain.ts
```

**D. Testes**
```bash
cp __tests__-brain.test.ts ./__tests__/brain.test.ts
```

---

### 2️⃣ Criar Migração

```bash
# Gerar migração do Prisma
npx prisma migrate dev --name add_brain_models

# Escolha um nome descritivo:
# "add_brain_models" ou "add_knowledge_graph"
```

Isso vai:
- Criar as tabelas no PostgreSQL
- Gerar tipos TypeScript automáticos
- Atualizar o cliente Prisma

---

### 3️⃣ Testar conectividade

```bash
# Verifica se as tabelas foram criadas corretamente
npx prisma db push

# Gera Prisma Client atualizado
npx prisma generate
```

---

### 4️⃣ Executar sincronização inicial

```bash
# Opção A: Via Node direto
node -r ts-node/register scripts/sync-brain.ts

# Opção B: Via npm script (adicione ao package.json)
npm run sync:brain
```

**Adicione ao `package.json`:**
```json
{
  "scripts": {
    "sync:brain": "ts-node scripts/sync-brain.ts",
    "test:brain": "jest __tests__/brain.test.ts --runInBand"
  }
}
```

Esperado:
```
[SYNC] ===== STARTING BRAIN SYNC =====
[SYNC] Step 1: Creating nodes from entities...
[SYNC] Created 15 Company nodes
[SYNC] Created 45 Application nodes
[SYNC] Created 230 Module nodes
...
[SYNC] ✓ Total nodes created: 1250
[SYNC] Step 2: Creating edges between entities...
[SYNC] ✓ Total edges created: 3400
[SYNC] Step 3: Validating integrity...
[SYNC] ✓ Brain integrity: VALID
[SYNC] ===== SYNC COMPLETED in 3245ms =====
```

---

### 5️⃣ Rodar testes

```bash
# Instale jest se não tiver
npm install --save-dev jest ts-jest @types/jest @jest/globals

# Configure jest.config.js (se não tiver):
```

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
```

**Rodar:**
```bash
npm run test:brain
```

Esperado:
```
 PASS  __tests__/brain.test.ts
  Brain - Cérebro do Quality Control
    Node Operations
      ✓ should create a Company node (45ms)
      ✓ should create an Application node (32ms)
      ✓ should search nodes by type (28ms)
    Edge Operations
      ✓ should create an edge between two nodes (54ms)
      ✓ should not create duplicate edges (38ms)
    Memory Operations
      ✓ should add a memory (41ms)
      ✓ should retrieve memories for a node (29ms)
    ...
  12 passed (2.5s)
```

---

## 🔧 Próximos passos (integração)

### Opção A: Re-sync automático

Adicione cron job que roda sync do brain a cada X horas:

```typescript
// lib/cron.ts
export async function setupBrainSync() {
  // A cada 6 horas, sincronizar brain
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled brain sync...')
    await syncBrain()
  })
}

// pages/api/brain/sync.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await syncBrain()
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: 'Sync failed', details: String(error) })
  }
}
```

### Opção B: Importar funções do brain em APIs existentes

```typescript
// pages/api/companies/[id].ts
import { getNodeWithContext, getNodeMemories } from '@/lib/brain'

export default async function handler(req, res) {
  const { id } = req.query

  // Buscar empresa + contexto de brain
  const company = await prisma.company.findUnique({ where: { id } })
  const brainContext = await getNodeWithContext(id)
  const memories = await getNodeMemories(id)

  res.json({
    company,
    brainContext,
    memories,
  })
}
```

---

## ✅ Checklist final

- [ ] Schema Prisma integrado
- [ ] Migração criada e aplicada (`npx prisma migrate dev`)
- [ ] Sync inicial executado com sucesso
- [ ] Brain integrity validada (result: VALID)
- [ ] Testes passando
- [ ] Funções de brain importáveis em APIs
- [ ] npm scripts adicionados ao package.json

---

## 🐛 Troubleshooting

### Erro: "Relation \"BrainNode\" does not exist"
→ Migração não foi aplicada. Rode `npx prisma migrate dev`

### Erro: "Cannot find module '@/lib/brain'"
→ Verifique o path alias no tsconfig.json:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Sync muito lento
→ Aumente batch size ou rode em ambiente com mais recursos
→ Para produção, considere rodar como job assíncrono

### Memória do script crescendo
→ Adicione `--max-old-space-size=4096` ao Node:
```bash
node --max-old-space-size=4096 -r ts-node/register scripts/sync-brain.ts
```

---

## 📊 Verificar integridade do brain

```typescript
// pages/api/brain/status.ts
import { validateBrainIntegrity } from '@/lib/brain'

export default async function handler(req, res) {
  const validation = await validateBrainIntegrity()
  res.json(validation)
}
```

Chamada:
```bash
curl http://localhost:3000/api/brain/status
```

Resposta esperada:
```json
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

## 🎯 Próxima fase (Fase 2: API Query)

Após confirmar que Fase 1 está 100% funcional, vamos para:
- Endpoints REST para consultar o brain
- GraphQL (opcional)
- Performance otimizada com cache
- Busca global

Aguarde o prompt da Fase 2!
