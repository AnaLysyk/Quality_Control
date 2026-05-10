# Test Data Hub — Implementation Guide

## Overview

Test Data Hub é a nova camada central de governança de dados de teste no painel-qa. Ela conecta Documentação de Automação, Assets de Teste, Base64 e Playwright em um fluxo único e rastreável.

**Objetivo principal**: Código vai para GitHub. Dado sensível (biometria, documentos pessoais, Base64) fica governado via API com permissão, sensibilidade e auditoria.

## Architecture

```
Documentação de Automação
    ↓ (PDF/imagens)
AutomationDocument + AutomationDocumentFragment
    ↓ (recortes com ID)
TestDataAsset (com key, label, sensitivity, encoding)
    ↓ (agrupados)
TestDataPack (biometric_set, document_set, etc)
    ↓ (vinculados)
TestCase ou TestAutomationLink
    ↓ (resolvidos em runtime)
Playwright → testAssets.resolve(assetIds)
    ↓ (com API segura)
/api/test-data-assets/resolve → retorna file, buffer ou base64
    ↓ (temporário, expirado)
Fixture baixa arquivo ou Base64
    ↓ (usado no teste)
setInputFiles(), APIRequestContext.multipart, ou Base64 payload
    ↓ (registrado)
ExecutionAssetUsage (qual asset foi usado)
```

## Models (Prisma)

### AutomationDocument
Documentos PDF/imagens que servem como origem de assets.

```prisma
model AutomationDocument {
  id           String   @id @default(cuid())
  companySlug  String
  projectId    String?
  title        String
  documentType String   // "biometric_form", "document_template", etc
  fileName     String
  mimeType     String   // "application/pdf", "image/png", etc
  storagePath  String
  status       String   @default("active")
  version      Int      @default(1)
  checksum     String?
  metadata     Json?
  createdBy    String
  updatedBy    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  fragments    AutomationDocumentFragment[]
  assets       TestDataAsset[]
}
```

### AutomationDocumentFragment
Recortes/pedaços de um documento com coordenadas.

```prisma
model AutomationDocumentFragment {
  id             String   @id @default(cuid())
  documentId     String
  companySlug    String
  projectId      String?
  label          String   // "Indicador direito", "Face", etc
  fragmentType   String   // "biometric_image", "document_page", etc
  pageNumber     Int?
  coordinates    Json?    // { x, y, width, height }
  mimeType       String
  storagePath    String?
  base64Preview  String?
  checksum       String?
  metadata       Json?
  createdBy      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  document       AutomationDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  assets         TestDataAsset[]
}
```

### TestDataAsset
Asset individual com ID estável, tipo, sensibilidade e encoding.

```prisma
model TestDataAsset {
  id             String   @id @default(cuid())
  companySlug    String
  projectId      String?
  documentId     String?
  fragmentId     String?

  key            String   @unique   // "asset_finger_right_index_001"
  label          String            // "Indicador direito"
  assetType      String            // "biometric_image", "base64_payload", etc
  
  mimeType       String?
  encoding       String?           // "file" ou "base64"
  
  storagePath    String?           // Para encoding=file
  base64Value    String?           // Para encoding=base64
  sizeBytes      Int?
  checksum       String?
  
  sensitivity    String   @default("internal")
  // public | internal | restricted | sensitive
  
  status         String   @default("active")
  // active | outdated | needs_review | deprecated | archived
  
  metadata       Json?
  createdBy      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  document       AutomationDocument? @relation(...)
  fragment       AutomationDocumentFragment? @relation(...)
  caseLinks      TestCaseAssetLink[]
  automationLinks AutomationAssetUsage[]
  packItems      TestDataPackItem[]
  usagePolicy    TestDataAssetUsagePolicy?
  audit          TestDataAssetAudit[]
}
```

### TestDataAssetUsagePolicy
Define como um asset pode ser usado (upload, API, Base64, etc).

```prisma
model TestDataAssetUsagePolicy {
  id        String @id @default(cuid())
  assetId   String @unique

  allowPlaywrightUpload Boolean @default(true)
  allowApiMultipart     Boolean @default(true)
  allowBase64Api        Boolean @default(false)
  allowPromptMetadata   Boolean @default(true)
  allowPromptContent    Boolean @default(false)
  allowGithubCommit     Boolean @default(false)
  allowReportMetadata   Boolean @default(true)
  allowReportContent    Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  asset     TestDataAsset @relation(...)
}
```

### TestDataPack
Agrupamento de assets com roles (ex: biometria completa).

```prisma
model TestDataPack {
  id          String   @id @default(cuid())
  companySlug String
  projectId   String?
  key         String   @unique      // "pack_biometria_completa_001"
  label       String
  description String?
  packType    String                // "biometric_set", "document_set", etc
  
  sensitivity String @default("internal")
  status      String @default("active")
  metadata    Json?
  
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       TestDataPackItem[]
}
```

### TestDataPackItem
Item individual dentro de um pack, com role (ex: "right_index").

```prisma
model TestDataPackItem {
  id        String @id @default(cuid())
  packId    String
  assetId   String
  role      String          // "right_thumb", "left_index", "face_photo", etc
  required  Boolean @default(true)
  order     Int?

  pack      TestDataPack @relation(...)
  asset     TestDataAsset @relation(...)

  @@unique([packId, assetId, role])
}
```

### TestCaseAssetLink
Vínculo entre um caso de teste e um asset.

```prisma
model TestCaseAssetLink {
  id          String   @id @default(cuid())
  testCaseId  String
  assetId     String
  stepId      String?
  usage       String   // "upload", "api_payload", "biometric_input", etc
  variableName String?
  required    Boolean  @default(true)
  createdBy   String
  createdAt   DateTime @default(now())

  asset       TestDataAsset @relation(...)

  @@unique([testCaseId, assetId, stepId])
}
```

### AutomationAssetUsage
Uso de asset em um script Playwright.

```prisma
model AutomationAssetUsage {
  id                  String   @id @default(cuid())
  automationLinkId     String
  assetId              String
  variableName         String
  usage                String   // "setInputFiles", "apiMultipart", "apiBase64"
  generatedSnippet     String?
  createdBy            String
  createdAt            DateTime @default(now())

  asset                TestDataAsset @relation(...)

  @@unique([automationLinkId, assetId, variableName])
}
```

### ExecutionAssetUsage
Registro de qual asset foi usado em qual execução.

```prisma
model ExecutionAssetUsage {
  id              String   @id @default(cuid())
  executionId     String
  resultId        String?
  assetId         String
  testCaseId      String?
  usage           String
  status          String   @default("used")
  metadata        Json?
  createdAt       DateTime @default(now())
}
```

### TestDataAssetAudit
Log de auditoria de cada ação com o asset.

```prisma
model TestDataAssetAudit {
  id          String   @id @default(cuid())
  assetId     String
  action      String   // "created", "resolved_for_playwright", "downloaded", etc
  actorUserId String
  companySlug String
  projectId   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  asset       TestDataAsset @relation(...)
}
```

## APIs

### Resolve Assets (Critical for Playwright)

#### POST /api/test-data-assets/resolve

Resolve um ou mais assets por ID. Retorna URLs temporárias de download ou Base64.

**Request**:
```json
{
  "assetIds": ["asset_finger_right_index_001", "asset_face_photo_001"],
  "format": "file",
  "purpose": "playwright"
}
```

**Response** (format=file):
```json
{
  "assets": [
    {
      "assetId": "asset_finger_right_index_001",
      "key": "fingerRightIndex",
      "mimeType": "image/png",
      "fileName": "finger-right-index.png",
      "downloadUrl": "/api/test-data-assets/asset.../content?expires=...",
      "expiresAt": "2026-05-09T15:30:00Z"
    }
  ]
}
```

**Response** (format=base64):
```json
{
  "assets": [
    {
      "assetId": "asset_finger_right_index_001",
      "key": "fingerRightIndex",
      "mimeType": "image/png",
      "encoding": "base64",
      "base64": "iVBORw0KGgo..."
    }
  ]
}
```

#### GET /api/test-data-assets/:id/content

Download do conteúdo do asset. Requer URL com token e expiração válida.

### Resolve Test Data Packs

#### POST /api/test-data-packs/resolve

Resolve um pack completo. Retorna lista de assets com roles.

**Request**:
```json
{
  "packId": "pack_biometria_completa_001",
  "format": "file",
  "purpose": "playwright"
}
```

**Response**:
```json
{
  "assets": [
    {
      "assetId": "asset_001",
      "key": "fingerRightIndex",
      "role": "right_index",
      "mimeType": "image/png",
      "downloadUrl": "...",
      "expiresAt": "..."
    }
  ]
}
```

### CRUD Assets

#### GET /api/test-data-assets

Listar assets com filtros.

**Query**:
- `companySlug` (required)
- `projectId` (optional)
- `assetType` (optional)
- `sensitivity` (optional)
- `status` (optional)
- `search` (optional)
- `skip` (default: 0)
- `take` (default: 20, max: 100)

#### POST /api/test-data-assets

Criar novo asset.

**Request**:
```json
{
  "companySlug": "griaule",
  "projectId": "proj_123",
  "fragmentId": "frag_123",
  "key": "asset_finger_right_index_001",
  "label": "Indicador direito",
  "assetType": "biometric_image",
  "mimeType": "image/png",
  "encoding": "base64",
  "base64Value": "iVBORw0KGgo...",
  "sensitivity": "restricted"
}
```

#### GET /api/test-data-assets/:id

Obter asset individual com links.

#### PATCH /api/test-data-assets/:id

Atualizar asset (label, status, sensitivity, metadata).

#### DELETE /api/test-data-assets/:id

Deletar asset (falha se estiver em uso).

## Playwright Fixture

### testAssets.resolve(assetIds)

Resolve múltiplos assets como arquivos temporários.

```typescript
const assets = await testAssets.resolve([
  "asset_finger_right_index_001",
  "asset_face_photo_001",
]);

const finger = assets.get("asset_finger_right_index_001");
console.log(finger.filePath);  // /tmp/tc-assets-.../fingerRightIndex.png
console.log(finger.mimeType);  // "image/png"
```

### testAssets.resolveAsBuffer(assetId)

Resolve um asset como Buffer em memória.

```typescript
const asset = await testAssets.resolveAsBuffer("asset_finger_right_index_001");
await page.getByTestId("upload").setInputFiles({
  name: asset.key,
  mimeType: asset.mimeType,
  buffer: asset.buffer,
});
```

### testAssets.resolveAsBase64(assetId)

Resolve um asset como Base64 string.

```typescript
const asset = await testAssets.resolveAsBase64("asset_finger_right_index_001");
await request.post("/api/biometrics/base64", {
  data: {
    mimeType: asset.mimeType,
    base64: asset.base64,
  },
});
```

### testAssets.resolvePack(packId)

Resolve um pack completo com roles.

```typescript
const pack = await testAssets.resolvePack("pack_biometria_completa_001");
await biometricPage.uploadFinger("right-index", pack.get("right_index").filePath);
await biometricPage.uploadFinger("left-thumb", pack.get("left_thumb").filePath);
```

## Usage Examples

### Upload Visual com setInputFiles

```typescript
import { test } from "../fixtures/test-assets.fixture";

test("@tc-1042 enviar biometria do indicador direito", async ({ page, testAssets }, testInfo) => {
  const assets = await testAssets.resolve(["asset_finger_right_index_001"]);
  const finger = assets.get("asset_finger_right_index_001");

  await page.getByTestId("finger-upload").setInputFiles(finger.filePath);
  await expect(page.getByText(/biometria enviada/i)).toBeVisible();

  // Attach metadata (not content!) to report
  await testInfo.attach("asset-used", {
    body: JSON.stringify({
      assetId: finger.assetId,
      key: finger.key,
      mimeType: finger.mimeType,
    }, null, 2),
    contentType: "application/json",
  });
});
```

### Upload por API Multipart

```typescript
test("@tc-1043 enviar biometria por API multipart", async ({ request, testAssets }) => {
  const asset = await testAssets.resolveAsBuffer("asset_finger_right_index_001");

  const response = await request.post("/api/biometrics/upload", {
    multipart: {
      protocol: "PROTOCOLO_TESTE",
      finger: "right-index",
      file: {
        name: asset.key + ".png",
        mimeType: asset.mimeType,
        buffer: asset.buffer,
      },
    },
  });

  expect(response.ok()).toBeTruthy();
});
```

### Upload por Base64 API

```typescript
test("@tc-1044 enviar biometria em Base64", async ({ request, testAssets }) => {
  const asset = await testAssets.resolveAsBase64("asset_finger_right_index_001");

  const response = await request.post("/api/biometrics/base64", {
    data: {
      protocol: "PROTOCOLO_TESTE",
      finger: "right-index",
      mimeType: asset.mimeType,
      base64: asset.base64,
    },
  });

  expect(response.ok()).toBeTruthy();
});
```

## Security

### Permission & Sensitivity

Cada asset tem um `sensitivity` level:
- `public`: acessível para qualquer usuário
- `internal`: visível dentro da empresa
- `restricted`: apenas QAs/admins da empresa
- `sensitive`: apenas admin e suporte técnico

### Usage Policy

Cada asset tem uma `TestDataAssetUsagePolicy` que define:
- `allowPlaywrightUpload`: pode ser usado em setInputFiles?
- `allowApiMultipart`: pode ser usado em multipart?
- `allowBase64Api`: pode retornar Base64?
- `allowPromptContent`: pode enviar conteúdo bruto para IA?
- `allowGithubCommit`: pode ser commitado no GitHub?
- `allowReportContent`: pode aparecer no report?

### GitHub Guardrail

Antes de publicar código:
```typescript
if (asset.sensitivity === "sensitive" || asset.sensitivity === "restricted") {
  if (codeContains(base64Value) || codeContains(filePath)) {
    throw new Error("Cannot commit sensitive asset content!");
  }
}
```

### Audit

Cada ação é registrada em `TestDataAssetAudit`:
- `asset.created`
- `asset.resolved_for_playwright`
- `asset.downloaded`
- `asset.used_in_execution`
- `asset.base64_viewed`
- `asset.base64_copied`
- `asset.deleted`

## Próximos Passos

1. ✅ Models Prisma criados
2. ✅ Fixture testAssets criada
3. ✅ APIs de resolve criadas
4. ✅ APIs CRUD básicas criadas
5. ⏳ Frontend para Documentação de Automação
6. ⏳ Frontend para Biblioteca de Assets
7. ⏳ Frontend para Test Data Packs
8. ⏳ Integração com StoredTestCase (vincular assets)
9. ⏳ Integração com TestAutomationLink (vincular a automações)
10. ⏳ Testes E2E e guardrails de segurança
