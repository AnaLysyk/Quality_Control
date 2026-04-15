# QUICK_START.md

## 🚀 INÍCIO RÁPIDO (5 minutos)

### 1. Integrar schema
Abra prisma/schema.prisma e adicione o conteúdo de schema-brain.prisma ao final.

### 2. Criar tabelas
npx prisma migrate dev --name add_brain_models

### 3. Atualizar Prisma
generate
npx prisma generate

### 4. Popular brain
Adicione ao package.json: "sync:brain": "ts-node scripts/sync-brain.ts"

npm run sync:brain

### 5. Testar
npm install --save-dev jest ts-jest @types/jest
npm run test:brain

---

## 🔌 Usar em seu código

```typescript
import { getNodeWithContext, getNodeMemories } from '@/lib/brain'

export default async function handler(req, res) {
  const context = await getNodeWithContext('node-id')
  const memories = await getNodeMemories('node-id')
  res.json({ context, memories })
}
```

---

Consulte INSTALLATION_GUIDE.md e EXAMPLES.md para detalhes e exemplos avançados.
