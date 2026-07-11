import "server-only";

import crypto from "crypto";

import type { BrainAccessContext } from "@/lib/brain/access";
import { canAccess } from "@/lib/permissions/can-access";
import { prisma } from "@/lib/prismaClient";
import { guardOutboundUrl } from "@/lib/brain/ssrfGuard";

type JsonRecord = Record<string, unknown>;

type BrainSourceRow = {
  id: string;
  name: string;
  description?: string | null;
  sourceType: string;
  provider?: string | null;
  status: string;
  scopeType: string;
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  ownerUserId?: string | null;
  allowedRoles?: unknown;
  allowedUsers?: unknown;
  requiredPermission?: string | null;
  environment: string;
  priority: number;
  useForCompanyContext: boolean;
  useForGeneralQuestions: boolean;
  useForRagIngestion: boolean;
  useForLiveQuery: boolean;
  config?: unknown;
  lastSyncAt?: Date | string | null;
  lastSuccessAt?: Date | string | null;
  lastErrorAt?: Date | string | null;
  lastErrorMessage?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  secrets?: BrainSourceSecretRow[];
};

type BrainSourceSecretRow = {
  id: string;
  sourceId: string;
  key: string;
  label?: string | null;
  maskedValue?: string | null;
  encryptedValue?: string;
  encryptionHint?: string | null;
};

type ModelDelegate = {
  findMany?: (args?: JsonRecord) => Promise<unknown[]>;
  findUnique?: (args: JsonRecord) => Promise<unknown | null>;
  create?: (args: JsonRecord) => Promise<unknown>;
  update?: (args: JsonRecord) => Promise<unknown>;
  delete?: (args: JsonRecord) => Promise<unknown>;
  upsert?: (args: JsonRecord) => Promise<unknown>;
};

const SOURCE_TYPES = new Set([
  "external_api",
  "external_database",
  "public_site",
  "free_web",
  "internal_wiki",
  "file_document",
  "webhook",
  "internal_system",
]);

const STATUSES = new Set(["active", "inactive", "draft", "error"]);
const SCOPE_TYPES = new Set(["global", "company", "project", "user"]);
const ENVIRONMENTS = new Set(["production", "staging", "homolog", "dev"]);
const SENSITIVE_KEY_RE = /(password|senha|token|secret|apikey|api_key|authorization|credential|connectionstring|privatekey|clientsecret)/i;

export class BrainSourceStorageUnavailableError extends Error {
  constructor(message = "As tabelas de configuracao do Brain ainda nao existem. Aplique a migration brain_source_settings.") {
    super(message);
    this.name = "BrainSourceStorageUnavailableError";
  }
}

function getDelegate(name: string): ModelDelegate | null {
  const db = prisma as unknown as Record<string, ModelDelegate | undefined>;
  return db[name] ?? null;
}

function getDelegates() {
  const source = getDelegate("brainSourceConfig");
  const secret = getDelegate("brainSourceSecret");
  const audit = getDelegate("brainSourceAuditLog");
  const sync = getDelegate("brainSourceSyncLog");

  if (!source?.findMany || !source?.create || !source?.update) {
    throw new BrainSourceStorageUnavailableError();
  }

  return { source, secret, audit, sync };
}

export function isBrainSourceStorageUnavailable(error: unknown) {
  if (error instanceof BrainSourceStorageUnavailableError) return true;
  const record = error as { code?: string; message?: string };
  return (
    record?.code === "P2021" ||
    record?.code === "P2022" ||
    /brain_source_|does not exist|tabela|relation .* does not exist/i.test(record?.message ?? "")
  );
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(asString).filter((item): item is string => Boolean(item));
  }
  const single = asString(value);
  return single ? single.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function intValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function enumValue(value: unknown, allowed: Set<string>, fallback: string) {
  const text = asString(value)?.toLowerCase();
  return text && allowed.has(text) ? text : fallback;
}

function compactDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function sanitizeConfig(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeConfig(item, depth + 1));
  if (!value || typeof value !== "object") return value;

  const output: JsonRecord = {};
  for (const [key, item] of Object.entries(value as JsonRecord)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      output[key] = "[SECRET_STORED_SEPARATELY]";
      continue;
    }
    output[key] = sanitizeConfig(item, depth + 1);
  }
  return output;
}

function collectConfig(input: JsonRecord) {
  return sanitizeConfig({
    ...(asRecord(input.config)),
    api: {
      baseUrl: input.baseUrl,
      authType: input.authType,
      apiKeyName: input.apiKeyName,
      apiKeyLocation: input.apiKeyLocation,
      oauthAuthUrl: input.oauthAuthUrl,
      oauthTokenUrl: input.oauthTokenUrl,
      oauthRedirectUri: input.oauthRedirectUri,
      oauthScopes: asStringArray(input.oauthScopes),
      oauthAudience: input.oauthAudience,
      defaultHeaders: asRecord(input.defaultHeaders),
      allowedHeaders: asStringArray(input.allowedHeaders),
      defaultQueryParams: asRecord(input.defaultQueryParams),
      allowedMethods: asStringArray(input.allowedMethods),
      timeoutMs: intValue(input.timeoutMs, 5000),
      retryCount: intValue(input.retryCount, 0),
      rateLimitPerMinute: intValue(input.rateLimitPerMinute, 60),
      healthCheckUrl: input.healthCheckUrl,
      testEndpoint: input.testEndpoint,
      responseFormat: input.responseFormat,
      paginationType: input.paginationType,
      enabledForBrain: boolValue(input.enabledForBrain, true),
    },
    database: {
      dbType: input.dbType,
      connectionMode: input.connectionMode,
      host: input.host,
      port: input.port,
      databaseName: input.databaseName ?? input.dbname,
      schemaName: input.schemaName,
      sslMode: input.sslMode,
      connectionTimeoutMs: intValue(input.connectionTimeoutMs, 5000),
      queryTimeoutMs: intValue(input.queryTimeoutMs, 5000),
      readOnly: boolValue(input.readOnly, true),
      allowedSchemas: asStringArray(input.allowedSchemas),
      allowedTables: asStringArray(input.allowedTables),
      blockedTables: asStringArray(input.blockedTables),
      allowedViews: asStringArray(input.allowedViews),
      sampleQuery: input.sampleQuery,
      healthCheckQuery: input.healthCheckQuery,
      maxRowsPerQuery: intValue(input.maxRowsPerQuery, 100),
      allowWrite: false,
      allowSchemaInspection: boolValue(input.allowSchemaInspection, false),
      enabledForRag: boolValue(input.enabledForRag, false),
      enabledForLiveQuery: boolValue(input.enabledForLiveQuery, false),
    },
    web: {
      baseUrl: input.baseUrl,
      allowedDomains: asStringArray(input.allowedDomains),
      blockedDomains: asStringArray(input.blockedDomains),
      startUrls: asStringArray(input.startUrls),
      crawlDepth: intValue(input.crawlDepth, 1),
      maxPages: intValue(input.maxPages, 25),
      obeyRobotsTxt: boolValue(input.obeyRobotsTxt, true),
      refreshInterval: input.refreshInterval,
      includePatterns: asStringArray(input.includePatterns),
      excludePatterns: asStringArray(input.excludePatterns),
      contentTypes: asStringArray(input.contentTypes),
      requiresAuth: boolValue(input.requiresAuth, false),
      authSourceId: input.authSourceId,
      allowFreeWebFallback: boolValue(input.allowFreeWebFallback, false),
    },
    github: {
      owner: input.githubOwner,
      repo: input.githubRepo,
    },
    file: {
      originalName: input.fileOriginalName,
      mimeType: input.fileMimeType,
      sizeBytes: intValue(input.fileSizeBytes, 0),
      extractedChars: intValue(input.fileExtractedChars, 0),
      truncated: boolValue(input.fileTruncated, false),
    },
  }) as JsonRecord;
}

function encryptionKey() {
  const seed =
    process.env.BRAIN_SECRET_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? null : "local-development-brain-source-secret");

  if (!seed) {
    throw new Error("BRAIN_SECRET_ENCRYPTION_KEY is required to store Brain source secrets in production.");
  }

  return crypto.createHash("sha256").update(seed).digest();
}

function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}

function decryptSecret(value: string) {
  const [version, ivPart, tagPart, dataPart] = value.split(":");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) {
    throw new Error("Formato de segredo desconhecido");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Le e descriptografa um segredo de uma fonte, para uso pontual no backend (ex.: token para
 * chamar uma API externa em nome do usuario). Nunca retornar isso para o frontend.
 * Sempre valida visibilidade/permissao via getBrainSourceById antes de descriptografar.
 */
export async function getDecryptedSourceSecret(sourceId: string, key: string, access: BrainAccessContext) {
  const source = await getBrainSourceById(sourceId, access);
  if (!source) return null;

  const secretDelegate = getDelegate("brainSourceSecret");
  const rows = (await secretDelegate?.findMany?.({ where: { sourceId, key } }) ?? []) as BrainSourceSecretRow[];
  const row = rows[0];
  if (!row?.encryptedValue) return null;
  return decryptSecret(row.encryptedValue);
}

function extractSecrets(input: JsonRecord) {
  const secretValues = asRecord(input.secretValues);
  const collected: Array<{ key: string; label?: string; value: string }> = [];

  for (const [key, value] of Object.entries(secretValues)) {
    const text = asString(value);
    if (text) collected.push({ key, value: text });
  }

  const topLevelSecretKeys = [
    "apiKey",
    "token",
    "bearerToken",
    "password",
    "username",
    "connectionString",
    "oauthClientSecret",
    "sslCertificate",
  ];

  for (const key of topLevelSecretKeys) {
    const text = asString(input[key]);
    if (text) collected.push({ key, value: text });
  }

  return collected;
}

function actorId(access: BrainAccessContext) {
  return access.user.id ?? access.user.email ?? null;
}

export function canReadBrainSources(access: BrainAccessContext) {
  return (
    access.hasGlobalVisibility ||
    canAccess(access.userAccess, { moduleId: "brain", action: "view_external_sources" }) ||
    canAccess(access.userAccess, { moduleId: "brain", action: "configure_sources" })
  );
}

export function canConfigureBrainSources(access: BrainAccessContext) {
  return (
    access.hasGlobalVisibility ||
    canAccess(access.userAccess, { moduleId: "brain", action: "configure_sources" }) ||
    canAccess(access.userAccess, { moduleId: "brain", action: "admin" })
  );
}

function sourceIsVisibleToAccess(source: Pick<BrainSourceRow, "scopeType" | "companyId" | "companySlug" | "projectId" | "ownerUserId">, access: BrainAccessContext) {
  if (access.hasGlobalVisibility) return true;
  if (source.ownerUserId && source.ownerUserId === access.user.id) return true;
  if (source.companyId && access.allowedCompanyIds.has(source.companyId)) return true;
  if (source.companySlug && access.allowedCompanySlugs.has(source.companySlug.toLowerCase())) return true;
  if (source.projectId && access.allowedProjectIds.has(source.projectId)) return true;
  return false;
}

function ensureScopeCanBeWritten(input: JsonRecord, access: BrainAccessContext) {
  if (!canConfigureBrainSources(access)) {
    throw new Error("Sem permissao para configurar fontes do Brain");
  }

  const requestedScope = enumValue(input.scopeType, SCOPE_TYPES, access.hasGlobalVisibility ? "global" : "company");
  const companyId = asString(input.companyId);
  const companySlug = asString(input.companySlug)?.toLowerCase() ?? null;
  const projectId = asString(input.projectId);

  if (access.hasGlobalVisibility) {
    return { scopeType: requestedScope, companyId, companySlug, projectId };
  }

  const fallbackCompanyId = Array.from(access.allowedCompanyIds)[0] ?? null;
  const fallbackCompanySlug = Array.from(access.allowedCompanySlugs)[0] ?? null;
  const resolvedCompanyId = companyId && access.allowedCompanyIds.has(companyId) ? companyId : fallbackCompanyId;
  const resolvedCompanySlug = companySlug && access.allowedCompanySlugs.has(companySlug) ? companySlug : fallbackCompanySlug;
  const resolvedProjectId = projectId && access.allowedProjectIds.has(projectId) ? projectId : null;

  if (!resolvedCompanyId && !resolvedCompanySlug && requestedScope !== "user") {
    throw new Error("Sem escopo de empresa para configurar esta fonte");
  }

  return {
    scopeType: requestedScope === "project" && resolvedProjectId ? "project" : requestedScope === "user" ? "user" : "company",
    companyId: resolvedCompanyId,
    companySlug: resolvedCompanySlug,
    projectId: resolvedProjectId,
  };
}

function sourceWhereForAccess(access: BrainAccessContext) {
  if (access.hasGlobalVisibility) return {};

  const or: JsonRecord[] = [];
  const companyIds = Array.from(access.allowedCompanyIds);
  const companySlugs = Array.from(access.allowedCompanySlugs);
  const projectIds = Array.from(access.allowedProjectIds);

  if (companyIds.length) or.push({ companyId: { in: companyIds } });
  if (companySlugs.length) or.push({ companySlug: { in: companySlugs } });
  if (projectIds.length) or.push({ projectId: { in: projectIds } });
  if (access.user.id) or.push({ ownerUserId: access.user.id });

  return or.length ? { OR: or } : { id: "__no_access__" };
}

function serializeSource(row: unknown) {
  const source = row as BrainSourceRow;
  const secrets = Array.isArray(source.secrets) ? source.secrets : [];
  return {
    id: source.id,
    name: source.name,
    description: source.description ?? null,
    sourceType: source.sourceType,
    provider: source.provider ?? null,
    status: source.status,
    scopeType: source.scopeType,
    companyId: source.companyId ?? null,
    companySlug: source.companySlug ?? null,
    projectId: source.projectId ?? null,
    projectSlug: source.projectSlug ?? null,
    ownerUserId: source.ownerUserId ?? null,
    allowedRoles: source.allowedRoles ?? [],
    allowedUsers: source.allowedUsers ?? [],
    requiredPermission: source.requiredPermission ?? null,
    environment: source.environment,
    priority: source.priority,
    useForCompanyContext: source.useForCompanyContext,
    useForGeneralQuestions: source.useForGeneralQuestions,
    useForRagIngestion: source.useForRagIngestion,
    useForLiveQuery: source.useForLiveQuery,
    config: sanitizeConfig(source.config ?? {}),
    secrets: secrets.map((secret) => ({
      key: secret.key,
      label: secret.label ?? secret.key,
      maskedValue: secret.maskedValue ?? "[SECRET]",
    })),
    hasSecrets: secrets.length > 0,
    lastSyncAt: compactDate(source.lastSyncAt),
    lastSuccessAt: compactDate(source.lastSuccessAt),
    lastErrorAt: compactDate(source.lastErrorAt),
    lastErrorMessage: source.lastErrorMessage ?? null,
    createdBy: source.createdBy ?? null,
    createdAt: compactDate(source.createdAt),
    updatedBy: source.updatedBy ?? null,
    updatedAt: compactDate(source.updatedAt),
  };
}

// Convencao da ponte Configuracao -> Memoria: uma BrainMemory gerada a partir do
// processamento de uma fonte configurada usa sourceType="BRAIN_SOURCE" e sourceId=<id da fonte>.
export const BRAIN_SOURCE_MEMORY_TYPE = "BRAIN_SOURCE";

function computeProcessingStatus(
  source: Pick<BrainSourceRow, "status" | "lastErrorAt" | "lastSuccessAt">,
  memoriesGenerated: number,
) {
  if (source.status === "inactive" || source.status === "draft") return "desativado";
  if (source.lastErrorAt) return "erro";
  if (memoriesGenerated > 0) return "indexado";
  if (source.lastSuccessAt) return "aguardando_processamento";
  return "configurado";
}

async function attachMemoryStats<T extends { id: string; status: string; lastErrorAt: string | null; lastSuccessAt: string | null }>(
  sources: T[],
) {
  if (!sources.length) return sources.map((source) => ({ ...source, memoriesGenerated: 0, lastMemoryAt: null, processingStatus: computeProcessingStatus(source, 0) }));

  const ids = sources.map((source) => source.id);
  const grouped = await prisma.brainMemory.groupBy({
    by: ["sourceId"],
    where: { sourceType: BRAIN_SOURCE_MEMORY_TYPE, sourceId: { in: ids }, status: "ACTIVE" },
    _count: { _all: true },
    _max: { createdAt: true },
  }).catch(() => [] as Array<{ sourceId: string | null; _count: { _all: number }; _max: { createdAt: Date | null } }>);

  const statsById = new Map(
    grouped.filter((item) => item.sourceId).map((item) => [item.sourceId as string, item]),
  );

  return sources.map((source) => {
    const stats = statsById.get(source.id);
    const memoriesGenerated = stats?._count._all ?? 0;
    return {
      ...source,
      memoriesGenerated,
      lastMemoryAt: stats?._max.createdAt ? stats._max.createdAt.toISOString() : null,
      processingStatus: computeProcessingStatus(source, memoriesGenerated),
    };
  });
}

async function writeSourceAudit(sourceId: string | null, action: string, access: BrainAccessContext, before?: unknown, after?: unknown, reason?: string) {
  const audit = getDelegate("brainSourceAuditLog");
  await audit?.create?.({
    data: {
      sourceId,
      action,
      before: sanitizeConfig(before ?? null),
      after: sanitizeConfig(after ?? null),
      userId: actorId(access),
      reason,
    },
  }).catch(() => null);
}

async function upsertSecrets(sourceId: string, input: JsonRecord, access: BrainAccessContext) {
  const secretDelegate = getDelegate("brainSourceSecret");
  const secrets = extractSecrets(input);
  if (!secretDelegate?.upsert || secrets.length === 0) return;

  await Promise.all(secrets.map((secret) =>
    secretDelegate.upsert?.({
      where: { sourceId_key: { sourceId, key: secret.key } },
      update: {
        encryptedValue: encryptSecret(secret.value),
        maskedValue: maskSecret(secret.value),
        label: secret.label ?? secret.key,
        updatedBy: actorId(access),
      },
      create: {
        sourceId,
        key: secret.key,
        label: secret.label ?? secret.key,
        encryptedValue: encryptSecret(secret.value),
        maskedValue: maskSecret(secret.value),
        encryptionHint: "aes-256-gcm:v1",
        createdBy: actorId(access),
        updatedBy: actorId(access),
      },
    }),
  ));
}

function dataFromInput(input: JsonRecord, access: BrainAccessContext, existing?: BrainSourceRow | null) {
  const scope = ensureScopeCanBeWritten(input, access);
  const sourceType = enumValue(input.sourceType, SOURCE_TYPES, existing?.sourceType ?? "external_api");
  const status = enumValue(input.status, STATUSES, existing?.status ?? "draft");
  const environment = enumValue(input.environment, ENVIRONMENTS, existing?.environment ?? "dev");

  return {
    name: asString(input.name) ?? existing?.name ?? "Fonte do Brain",
    description: asString(input.description),
    sourceType,
    provider: asString(input.provider),
    status,
    scopeType: scope.scopeType,
    companyId: scope.companyId,
    companySlug: scope.companySlug,
    projectId: scope.projectId,
    projectSlug: asString(input.projectSlug),
    ownerUserId: asString(input.ownerUserId) ?? (scope.scopeType === "user" ? access.user.id : existing?.ownerUserId ?? null),
    allowedRoles: asStringArray(input.allowedRoles),
    allowedUsers: asStringArray(input.allowedUsers),
    requiredPermission: asString(input.requiredPermission),
    environment,
    priority: Math.min(100, Math.max(0, intValue(input.priority, existing?.priority ?? 50))),
    useForCompanyContext: boolValue(input.useForCompanyContext, existing?.useForCompanyContext ?? false),
    useForGeneralQuestions: boolValue(input.useForGeneralQuestions, existing?.useForGeneralQuestions ?? true),
    useForRagIngestion: boolValue(input.useForRagIngestion, existing?.useForRagIngestion ?? false),
    useForLiveQuery: boolValue(input.useForLiveQuery, existing?.useForLiveQuery ?? false),
    config: collectConfig(input),
    updatedBy: actorId(access),
  };
}

export async function listBrainSources(access: BrainAccessContext, params?: { status?: string | null; sourceType?: string | null }) {
  if (!canReadBrainSources(access)) throw new Error("Sem permissao para ver fontes do Brain");
  const { source } = getDelegates();
  const where = {
    ...sourceWhereForAccess(access),
    ...(params?.status ? { status: params.status } : {}),
    ...(params?.sourceType ? { sourceType: params.sourceType } : {}),
  };

  const rows = await source.findMany?.({
    where,
    include: { secrets: true },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: 200,
  }) ?? [];

  return attachMemoryStats(rows.map(serializeSource));
}

export async function getBrainSourceById(id: string, access: BrainAccessContext) {
  const { source } = getDelegates();
  const row = await source.findUnique?.({ where: { id }, include: { secrets: true } }) as BrainSourceRow | null;
  if (!row || !sourceIsVisibleToAccess(row, access)) return null;
  return row;
}

export async function createBrainSource(access: BrainAccessContext, body: unknown) {
  const input = asRecord(body);
  const { source } = getDelegates();
  const data = {
    ...dataFromInput(input, access),
    createdBy: actorId(access),
  };

  const created = await source.create?.({ data }) as BrainSourceRow;
  await upsertSecrets(created.id, input, access);
  await writeSourceAudit(created.id, "CREATE_SOURCE", access, null, created, "Fonte criada nas Configuracoes do Brain");
  const complete = await getBrainSourceById(created.id, access);
  const [enriched] = await attachMemoryStats([serializeSource(complete ?? created)]);
  return enriched;
}

export async function updateBrainSource(access: BrainAccessContext, id: string, body: unknown) {
  const existing = await getBrainSourceById(id, access);
  if (!existing) return null;
  if (!sourceIsVisibleToAccess(existing, access) || !canConfigureBrainSources(access)) {
    throw new Error("Sem permissao para alterar esta fonte");
  }

  const input = asRecord(body);
  const data = dataFromInput(input, access, existing);
  const { source } = getDelegates();
  const updated = await source.update?.({ where: { id }, data }) as BrainSourceRow;
  await upsertSecrets(id, input, access);
  await writeSourceAudit(id, "UPDATE_SOURCE", access, existing, updated, "Fonte atualizada nas Configuracoes do Brain");
  const complete = await getBrainSourceById(id, access);
  const [enriched] = await attachMemoryStats([serializeSource(complete ?? updated)]);
  return enriched;
}

export async function setBrainSourceStatus(access: BrainAccessContext, id: string, status: "active" | "inactive") {
  const existing = await getBrainSourceById(id, access);
  if (!existing) return null;
  if (!canConfigureBrainSources(access)) throw new Error("Sem permissao para alterar status da fonte");
  const { source } = getDelegates();
  const updated = await source.update?.({
    where: { id },
    data: { status, updatedBy: actorId(access) },
  }) as BrainSourceRow;
  await writeSourceAudit(id, status === "active" ? "ENABLE_SOURCE" : "DISABLE_SOURCE", access, existing, updated);
  const complete = await getBrainSourceById(id, access);
  const [enriched] = await attachMemoryStats([serializeSource(complete ?? updated)]);
  return enriched;
}

export async function deleteBrainSource(access: BrainAccessContext, id: string) {
  const existing = await getBrainSourceById(id, access);
  if (!existing) return false;
  if (!canConfigureBrainSources(access)) throw new Error("Sem permissao para excluir fonte");
  const { source } = getDelegates();
  await source.delete?.({ where: { id } });
  await writeSourceAudit(id, "DELETE_SOURCE", access, existing, null);
  return true;
}

async function probeHttpSource(source: BrainSourceRow) {
  const config = asRecord(source.config);
  const api = asRecord(config.api);
  const web = asRecord(config.web);
  const url = asString(api.healthCheckUrl) ?? asString(api.testEndpoint) ?? asString(api.baseUrl) ?? asString(web.baseUrl);
  if (!url) return { ok: false, status: "error", message: "URL de teste nao informada." };

  const guard = await guardOutboundUrl(url);
  if (!guard.ok) {
    return { ok: false, status: "error", message: `URL de teste bloqueada: ${guard.reason}` };
  }
  const parsed = guard.url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      redirect: "manual",
    });
    const isRedirect = response.status >= 300 && response.status < 400;
    return {
      ok: !isRedirect && response.status < 500,
      status: isRedirect ? "error" : response.status < 500 ? "success" : "error",
      message: isRedirect ? "Redirecionamento bloqueado por seguranca." : `HTTP ${response.status}`,
      metadata: { url: parsed.origin, responseStatus: response.status },
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Falha ao testar URL.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function writeSyncLog(sourceId: string, result: { status: string; message?: string; metadata?: unknown }) {
  const sync = getDelegate("brainSourceSyncLog");
  await sync?.create?.({
    data: {
      sourceId,
      kind: "test",
      status: result.status,
      message: result.message ?? null,
      metadata: sanitizeConfig(result.metadata ?? {}),
      finishedAt: new Date(),
    },
  }).catch(() => null);
}

export async function testBrainSource(access: BrainAccessContext, id: string) {
  const existing = await getBrainSourceById(id, access);
  if (!existing) return null;
  if (!canConfigureBrainSources(access)) throw new Error("Sem permissao para testar fonte");

  const isHttp = ["external_api", "public_site", "webhook", "internal_wiki"].includes(existing.sourceType);
  const result = isHttp
    ? await probeHttpSource(existing)
    : {
        ok: true,
        status: "success",
        message: existing.sourceType === "external_database"
          ? "Validacao estrutural concluida. Conexao real deve usar segredo do backend."
          : "Fonte validada em modo estrutural.",
      };

  const { source } = getDelegates();
  await source.update?.({
    where: { id },
    data: result.ok
      ? { lastSuccessAt: new Date(), lastErrorAt: null, lastErrorMessage: null, updatedBy: actorId(access) }
      : { status: "error", lastErrorAt: new Date(), lastErrorMessage: result.message, updatedBy: actorId(access) },
  }).catch(() => null);
  await writeSyncLog(id, result);
  await writeSourceAudit(id, "TEST_SOURCE", access, null, result);
  return result;
}

export async function listBrainSourceAudit(access: BrainAccessContext, limit = 100) {
  if (!canReadBrainSources(access)) throw new Error("Sem permissao para ver auditoria do Brain");
  const audit = getDelegate("brainSourceAuditLog");
  if (!audit?.findMany) throw new BrainSourceStorageUnavailableError();

  if (access.hasGlobalVisibility) {
    return audit.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  const sources = await listBrainSources(access);
  const sourceIds = sources.map((source) => source.id);
  if (!sourceIds.length) return [];
  return audit.findMany({
    where: { sourceId: { in: sourceIds } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
