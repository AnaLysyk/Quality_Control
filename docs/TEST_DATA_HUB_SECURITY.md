# Test Data Hub — Security Implementation

## Overview

Segurança no Test Data Hub funciona em três camadas:

1. **Permission Layer** — Quem pode acessar o quê
2. **Guardrails** — Regras de negócio de segurança
3. **Audit Trail** — Rastreabilidade completa

---

## 1. Permission Layer

### Localização
- `lib/test-data-hub/permissions.ts`

### Conceitos Principais

#### Sensibilidade (SensitivityLevel)
```
public       — Qualquer usuário acessa
internal     — Apenas usuários da empresa
restricted   — Apenas QA leads / admins da empresa
sensitive    — Apenas admin global / company_admin / technical_support
```

#### Acesso por Papel (Role)

Mapeamento de roles para max sensibilidade acessível:

| Role | Max Sensitivity | Pode Criar Assets? | Pode Deletar Assets? |
|------|-----------------|-------------------|----------------------|
| admin / company_admin | sensitive | Sim | Sim (todas) |
| leader_tc / technical_support | restricted | Sim | Sim (restricted) |
| it_dev / dev | internal | Sim | Não |
| support | internal | Não | Não |
| viewer | public | Não | Não |

### APIs de Permissão

```typescript
// Verificar acesso à empresa
canAccessCompany(user: AuthUser, companySlug: string): boolean

// Verificar acesso ao projeto
canAccessProject(user: AuthUser, companySlug: string, projectId?: string): boolean

// Obter nível máximo de sensibilidade do usuário
getMaxSensitivityForUser(user: AuthUser): SensitivityLevel

// Verificar se usuário pode acessar asset com sensibilidade X
canAccessSensitivity(user: AuthUser, sensitivity: SensitivityLevel): boolean

// Verificar se usuário pode criar assets
canCreateAsset(user: AuthUser, companySlug: string): boolean

// Verificar se usuário pode deletar asset
canDeleteAsset(user: AuthUser, companySlug: string, sensitivity: SensitivityLevel): boolean

// Verificar se usuário pode ver Base64 (mais restritivo)
canViewBase64(user: AuthUser, companySlug: string, sensitivity: SensitivityLevel): boolean

// Verificar se usuário pode vincular asset a caso
canLinkAssetToCase(user: AuthUser, companySlug: string): boolean
```

### Exemplo: POST /api/test-data-assets

```typescript
// 1. Autenticar usuário
const user = await authenticateRequest(request);
if (!user) return 401;

// 2. Verificar se pode criar asset
if (!canCreateAsset(user, companySlug)) {
  return 403; // "No permission to create assets in this company"
}

// 3. Criar asset com auditoria
const asset = await prisma.testDataAsset.create({...});

// 4. Logar na auditoria
await prisma.testDataAssetAudit.create({
  assetId: asset.id,
  action: "created",
  actorUserId: user.id,
  companySlug,
  metadata: { key, assetType, sensitivity }
});
```

---

## 2. Guardrails (Security Rules)

### Localização
- `lib/test-data-hub/guardrails.ts`

### PromptDataGuardrail

**Objetivo**: Garantir que IA/LLM NUNCA recebe conteúdo sensível bruto.

**O que IA recebe**:
```json
{
  "assetId": "asset_finger_right_index_001",
  "key": "fingerRightIndex",
  "label": "Indicador direito",
  "assetType": "biometric_image",
  "mimeType": "image/png",
  "sensitivity": "restricted"
}
```

**O que IA NUNCA recebe**:
- `base64Value` (raw)
- `storagePath` (internal path)
- Conteúdo de arquivo
- Biometria real
- PDF sensível

**Uso**:
```typescript
import { PromptDataGuardrail } from "@/lib/test-data-hub/guardrails";

// Sanitizar asset antes de enviar para IA
const safeAsset = PromptDataGuardrail.validateAssetForPrompt(asset);

// Gerar código com assets
PromptDataGuardrail.validateAssetsForCodeGeneration(assets);
```

### GitHubPublishGuardrail

**Objetivo**: Evitar commitar dados sensíveis para GitHub.

**Detecta**:
- Base64 strings longas
- data:image URIs
- Asset file paths em código
- URLs temporárias com tokens
- Storage paths
- Indicadores de biometria/conteúdo sensível

**Uso**:
```typescript
import { GitHubPublishGuardrail } from "@/lib/test-data-hub/guardrails";

const result = GitHubPublishGuardrail.validateCodeBeforePublish(code, {
  filePath: "tests-e2e/biometric.spec.ts",
  assetIds: ["asset_finger_right_index_001"],
});

if (!result.safe) {
  throw new Error(`Cannot publish: ${result.violations.join("\n")}`);
}

// Ou
GitHubPublishGuardrail.throwIfUnsafe(code);
```

### RunnerAssetGuardrail

**Objetivo**: Validar que runner tem permissão e contexto válido antes de resolver asset.

**Checks**:
- User autenticado
- Acesso à empresa
- Nível de sensibilidade
- Propósito válido

**Uso**:
```typescript
import { RunnerAssetGuardrail } from "@/lib/test-data-hub/guardrails";

RunnerAssetGuardrail.throwIfInvalid({
  user,
  companySlug: "griaule",
  projectId: "proj_123",
  assetId: "asset_001",
  assetSensitivity: "restricted",
  purpose: "playwright",
});

// Se inválido, throw GuardrailViolation
```

### Asset Usage Policy

**Objetivo**: Definir por-asset como ele pode ser usado.

```typescript
interface AssetUsagePolicy {
  allowPlaywrightUpload?: boolean;        // setInputFiles()
  allowApiMultipart?: boolean;             // POST multipart
  allowBase64Api?: boolean;                // POST base64
  allowPromptMetadata?: boolean;           // IA recebe metadata
  allowPromptContent?: boolean;            // IA recebe conteúdo bruto (RARO)
  allowGithubCommit?: boolean;             // Código pode ter asset?
  allowReportMetadata?: boolean;           // Report mostra metadata
  allowReportContent?: boolean;            // Report mostra conteúdo (RARO)
}
```

**Validação**:
```typescript
import { UsagePolicyValidator } from "@/lib/test-data-hub/guardrails";

UsagePolicyValidator.validateUsage(
  policy,
  "playwright_upload" // ou: api_multipart, api_base64, etc
);

// Se não permitido, throw GuardrailViolation
UsagePolicyValidator.throwIfNotAllowed(policy, "github_commit");
```

---

## 3. Audit Trail

### Ações Registradas

Cada ação com um asset é registrada em `TestDataAssetAudit`:

```
asset.created              — Asset foi criado
asset.updated              — Asset foi atualizado
asset.deleted              — Asset foi deletado
asset.resolved_as_file     — Asset foi resolvido como arquivo para Playwright
asset.resolved_as_base64   — Asset foi resolvido como Base64
asset.downloaded           — Conteúdo do asset foi baixado
asset.used_in_execution    — Asset foi usado em execução
asset.base64_viewed        — Base64 foi visualizado (UI)
asset.base64_copied        — Base64 foi copiado (UI)
asset.linked_to_case       — Asset foi vinculado a caso de teste
asset.linked_to_automation — Asset foi vinculado a script Playwright
```

### Registro Automático

Adicionado em todos os endpoints críticos:

```typescript
await prisma.testDataAssetAudit.create({
  data: {
    assetId: asset.id,
    action: "resolved_as_file",
    actorUserId: user.id,
    companySlug: asset.companySlug,
    projectId: asset.projectId,
    metadata: {
      purpose: "playwright",
      format: "file",
      sensitivity: asset.sensitivity,
    },
  },
});
```

### Consulta de Auditoria

```typescript
// Quem acessou esse asset?
const accesses = await prisma.testDataAssetAudit.findMany({
  where: { assetId },
  orderBy: { createdAt: "desc" },
});

// Quais assets esse usuário acessou?
const userAccesses = await prisma.testDataAssetAudit.findMany({
  where: { actorUserId },
  orderBy: { createdAt: "desc" },
});
```

---

## 4. Integração na API de Resolução

A API `/api/test-data-assets/resolve` aplica todas as três camadas:

```typescript
// Step 1: Authenticate
const user = await authenticateRequest(request);
if (!user) return 401;

// Step 2: Validate request format
if (!["file", "base64"].includes(format)) {
  return 400;
}

// Step 3: Fetch assets from database
const assets = await prisma.testDataAsset.findMany({...});

// Step 4: Apply permission checks to each asset
for (const asset of assets) {
  // Check company access
  if (!canAccessCompany(user, asset.companySlug)) {
    deny();
  }

  // Check sensitivity access
  if (!canAccessSensitivity(user, asset.sensitivity)) {
    deny();
  }

  // Check usage policy
  const policy = asset.usagePolicy;
  if (format === "base64" && !policy.allowBase64Api) {
    deny();
  }
}

// Step 5: Build response (format-specific)
// For Base64: only safe if policy allows
// For file: generate temporary download URL (15 min expiry)

// Step 6: Log all accesses to audit
for (const asset of assets) {
  await prisma.testDataAssetAudit.create({...});
}

return response;
```

---

## 5. Exemplos de Segurança em Ação

### Scenario 1: Usuário Viewer tenta acessar asset "restricted"

```
User: viewer (max sensitivity: "public")
Asset: "restricted"

✗ canAccessSensitivity(user, "restricted") → false
→ 403 Forbidden

Audit log:
- action: attempted_access_denied
- reason: sensitivity_too_high
```

### Scenario 2: QA tenta commitar Base64 em código

```typescript
// Arquivo: tests-e2e/biometric.spec.ts
const base64 = "iVBORw0KGgoAAAA..."; // 100KB Base64
// ↑ Código será checado antes de publicar

result = GitHubPublishGuardrail.validateCodeBeforePublish(code);
// ✗ Violations: ["Detected sensitive data pattern: /base64..."]

→ Publish bloqueado
```

### Scenario 3: IA pede conteúdo bruto de asset sensível

```typescript
// Backend detecta intenção de enviar asset bruto para IA
PromptDataGuardrail.validateAssetForPrompt(asset);
// ✗ Cannot send restricted asset Base64 to prompt

→ Throw GuardrailViolation
```

### Scenario 4: Suporte técnico tenta deletar asset "sensitive"

```
User: technical_support
Asset sensitivity: "sensitive"

✗ canDeleteAsset(user, company, "sensitive") → false
  (only admin e company_admin podem deletar sensitive)

→ 403 Forbidden
```

---

## 6. Checklist de Segurança

**Antes de usar Test Data Hub em produção**:

- [ ] Todas as APIs têm `authenticateRequest()` check
- [ ] Todos os endpoints validam `companySlug` access
- [ ] Sensitivity levels estão configurados corretamente
- [ ] Usage policies estão em cada asset (ou defaults aplicam)
- [ ] Audit logging funciona para todas as ações
- [ ] Download URLs expiram em 15 minutos
- [ ] IA nunca recebe conteúdo bruto sensível
- [ ] GitHub commit validation está ativo em CI/CD
- [ ] Runners validam permissões antes de resolver assets
- [ ] Base64 sensível é mascarado na UI

---

## 7. Próximos Passos

1. ✅ Permissão checks implementados em todas as APIs
2. ✅ Guardrails PromptData, GitHubPublish, RunnerAsset criados
3. ✅ Audit trail logging adicionado
4. ⏳ Frontend: Implementar permission-aware UI
5. ⏳ CI/CD: Adicionar GitHub publish guardrail validation
6. ⏳ Tests: E2E tests para permission scenarios
7. ⏳ Monitoring: Dashboard de auditoria
