import "server-only";

import type { BrainAccessContext } from "@/lib/brain/access";
import { canAccess } from "@/lib/permissions/can-access";
import { prisma } from "@/lib/prismaClient";

type JsonRecord = Record<string, unknown>;

export type BehaviorScopeType = "user" | "project" | "company" | "global";
export type BehaviorSurface = "home" | "chat" | "summary" | "report" | "audio";

const SCOPE_TYPES = new Set<BehaviorScopeType>(["user", "project", "company", "global"]);
const SURFACES = new Set<BehaviorSurface>(["home", "chat", "summary", "report", "audio"]);
// Ordem de prioridade na resolucao do perfil efetivo: o escopo mais especifico vence.
const SCOPE_PRIORITY: BehaviorScopeType[] = ["user", "project", "company", "global"];

type BehaviorProfileRow = {
  id: string;
  name: string;
  description?: string | null;
  instructions: string;
  tone?: string | null;
  formality?: string | null;
  responseLength?: string | null;
  rules?: unknown;
  scopeType: string;
  companyId?: string | null;
  projectId?: string | null;
  ownerUserId?: string | null;
  isSystem: boolean;
  status: string;
  version: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ModelDelegate = {
  findMany?: (args?: JsonRecord) => Promise<unknown[]>;
  findUnique?: (args: JsonRecord) => Promise<unknown | null>;
  create?: (args: JsonRecord) => Promise<unknown>;
  update?: (args: JsonRecord) => Promise<unknown>;
  delete?: (args: JsonRecord) => Promise<unknown>;
  upsert?: (args: JsonRecord) => Promise<unknown>;
};

export class BrainBehaviorProfileStorageUnavailableError extends Error {
  constructor(message = "As tabelas de perfis de comportamento do Brain ainda nao existem. Aplique a migration add_brain_behavior_profiles.") {
    super(message);
    this.name = "BrainBehaviorProfileStorageUnavailableError";
  }
}

export function isBrainBehaviorProfileStorageUnavailable(error: unknown) {
  if (error instanceof BrainBehaviorProfileStorageUnavailableError) return true;
  const record = error as { code?: string; message?: string };
  return (
    record?.code === "P2021" ||
    record?.code === "P2022" ||
    /brain_behavior_profile|does not exist|tabela|relation .* does not exist/i.test(record?.message ?? "")
  );
}

function getDelegate(name: string): ModelDelegate | null {
  const db = prisma as unknown as Record<string, ModelDelegate | undefined>;
  return db[name] ?? null;
}

function getDelegates() {
  const profile = getDelegate("brainBehaviorProfile");
  const assignment = getDelegate("brainBehaviorProfileAssignment");
  if (!profile?.findMany || !profile?.create || !profile?.update) {
    throw new BrainBehaviorProfileStorageUnavailableError();
  }
  return { profile, assignment };
}

function actorId(access: BrainAccessContext) {
  return access.user.id ?? access.user.email ?? null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const text = asString(value) as T | null;
  return text && allowed.has(text) ? text : fallback;
}

// Perfis fixos do sistema: nao dependem de banco, sempre disponiveis, nao editaveis/apagaveis.
const SYSTEM_PRESETS: BehaviorProfileRow[] = [
  ["preset-profissional", "Profissional", "Tom corporativo, direto e educado.", "formal"],
  ["preset-normal", "Normal", "Conversa equilibrada, sem formalidade excessiva.", "neutral"],
  ["preset-amigavel", "Amigável", "Tom acolhedor e próximo, mantendo clareza.", "casual"],
  ["preset-engracado", "Engraçado", "Tom leve e bem-humorado, sem perder a precisão técnica.", "casual"],
  ["preset-executivo", "Executivo", "Respostas curtas, focadas em decisão e impacto.", "formal"],
  ["preset-tecnico", "Técnico", "Detalhamento técnico, termos precisos, pouca simplificação.", "neutral"],
  ["preset-qa-especialista", "QA especialista", "Foco em qualidade, casos de teste, riscos e evidências.", "neutral"],
  ["preset-objetivo", "Objetivo", "Respostas curtas e diretas, sem rodeios.", "neutral"],
  ["preset-professor", "Professor", "Explica passo a passo, didático, com exemplos.", "neutral"],
].map(([id, name, description, formality]) => ({
  id,
  name,
  description,
  instructions: description,
  tone: name.toLowerCase(),
  formality,
  responseLength: "medium",
  rules: null,
  scopeType: "global",
  companyId: null,
  projectId: null,
  ownerUserId: null,
  isSystem: true,
  status: "active",
  version: 1,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}));

export const DEFAULT_BEHAVIOR_PROFILE_ID = "preset-profissional";

function serializeProfile(row: BehaviorProfileRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    instructions: row.instructions,
    tone: row.tone ?? null,
    formality: row.formality ?? null,
    responseLength: row.responseLength ?? null,
    rules: row.rules ?? null,
    scopeType: row.scopeType,
    companyId: row.companyId ?? null,
    projectId: row.projectId ?? null,
    ownerUserId: row.ownerUserId ?? null,
    isSystem: row.isSystem,
    status: row.status,
    version: row.version,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Regra de permissao por escopo (nao inventa acao nova no catalogo):
 * - "user": qualquer usuario autenticado do Brain configura o proprio escopo.
 * - "project"/"company": exige lib/permissionCatalog.ts brain:admin, ou acesso global de empresa.
 * - "global": exige permissao global explicita (isGlobalAdmin), nunca so hasGlobalVisibility.
 */
export function canConfigureBehaviorScope(access: BrainAccessContext, scopeType: BehaviorScopeType) {
  if (scopeType === "user") return true;
  if (scopeType === "global") return access.user.isGlobalAdmin === true;
  return access.hasGlobalVisibility || canAccess(access.userAccess, { moduleId: "brain", action: "admin" });
}

function scopeFilterForAccess(access: BrainAccessContext) {
  const ownScopes: JsonRecord[] = [{ scopeType: "user", ownerUserId: access.user.id }];
  if (access.allowedCompanyIds.size) ownScopes.push({ scopeType: "company", companyId: { in: Array.from(access.allowedCompanyIds) } });
  if (access.allowedProjectIds.size) ownScopes.push({ scopeType: "project", projectId: { in: Array.from(access.allowedProjectIds) } });
  ownScopes.push({ scopeType: "global" });
  return { OR: ownScopes };
}

export async function listBehaviorProfiles(access: BrainAccessContext) {
  const { profile } = getDelegates();
  const rows = (await profile.findMany?.({
    where: scopeFilterForAccess(access),
    orderBy: [{ scopeType: "asc" }, { updatedAt: "desc" }],
    take: 200,
  }) ?? []) as BehaviorProfileRow[];

  // Presets do sistema podem ter sido semeados no banco (setBehaviorAssignment faz isso
  // por causa da FK da atribuicao). Evita listar o mesmo preset duas vezes.
  const presetIds = new Set(SYSTEM_PRESETS.map((preset) => preset.id));
  const customRows = rows.filter((row) => !presetIds.has(row.id));

  return [...SYSTEM_PRESETS, ...customRows].map(serializeProfile);
}

async function getProfileById(id: string) {
  if (SYSTEM_PRESETS.some((preset) => preset.id === id)) {
    return SYSTEM_PRESETS.find((preset) => preset.id === id) ?? null;
  }
  const { profile } = getDelegates();
  return (await profile.findUnique?.({ where: { id } })) as BehaviorProfileRow | null;
}

export async function createBehaviorProfile(access: BrainAccessContext, body: unknown) {
  const input = (body ?? {}) as JsonRecord;
  const scopeType = enumValue(input.scopeType, SCOPE_TYPES, "user");
  if (!canConfigureBehaviorScope(access, scopeType)) {
    throw new Error("Sem permissao para criar perfil de comportamento neste escopo");
  }

  const name = asString(input.name);
  const instructions = asString(input.instructions);
  if (!name || !instructions) {
    throw new Error("Nome e instrucoes sao obrigatorios para o perfil de comportamento");
  }

  const companyId = scopeType === "company" ? (asString(input.companyId) ?? Array.from(access.allowedCompanyIds)[0] ?? null) : null;
  const projectId = scopeType === "project" ? (asString(input.projectId) ?? Array.from(access.allowedProjectIds)[0] ?? null) : null;
  const ownerUserId = scopeType === "user" ? access.user.id : null;

  if (scopeType === "company" && !companyId) throw new Error("Sem empresa para associar o perfil de comportamento");
  if (scopeType === "project" && !projectId) throw new Error("Sem projeto para associar o perfil de comportamento");

  const { profile } = getDelegates();
  const created = (await profile.create?.({
    data: {
      name,
      description: asString(input.description),
      instructions,
      tone: asString(input.tone),
      formality: asString(input.formality),
      responseLength: asString(input.responseLength),
      rules: input.rules ?? null,
      scopeType,
      companyId,
      projectId,
      ownerUserId,
      isSystem: false,
      status: "active",
      version: 1,
      createdBy: actorId(access),
      updatedBy: actorId(access),
    },
  })) as BehaviorProfileRow;

  return serializeProfile(created);
}

export async function updateBehaviorProfile(access: BrainAccessContext, id: string, body: unknown) {
  const existing = await getProfileById(id);
  if (!existing) return null;
  if (existing.isSystem) throw new Error("Perfis do sistema nao podem ser editados");
  if (!canConfigureBehaviorScope(access, existing.scopeType as BehaviorScopeType)) {
    throw new Error("Sem permissao para alterar este perfil de comportamento");
  }
  if (existing.scopeType === "user" && existing.ownerUserId !== access.user.id) {
    throw new Error("Sem permissao para alterar perfil de outro usuario");
  }

  const input = (body ?? {}) as JsonRecord;
  const { profile } = getDelegates();
  const updated = (await profile.update?.({
    where: { id },
    data: {
      name: asString(input.name) ?? existing.name,
      description: asString(input.description),
      instructions: asString(input.instructions) ?? existing.instructions,
      tone: asString(input.tone),
      formality: asString(input.formality),
      responseLength: asString(input.responseLength),
      rules: input.rules ?? existing.rules ?? null,
      version: existing.version + 1,
      updatedBy: actorId(access),
    },
  })) as BehaviorProfileRow;

  return serializeProfile(updated);
}

export async function deleteBehaviorProfile(access: BrainAccessContext, id: string) {
  const existing = await getProfileById(id);
  if (!existing) return false;
  if (existing.isSystem) throw new Error("Perfis do sistema nao podem ser excluidos");
  if (!canConfigureBehaviorScope(access, existing.scopeType as BehaviorScopeType)) {
    throw new Error("Sem permissao para excluir este perfil de comportamento");
  }
  if (existing.scopeType === "user" && existing.ownerUserId !== access.user.id) {
    throw new Error("Sem permissao para excluir perfil de outro usuario");
  }

  const { profile } = getDelegates();
  await profile.delete?.({ where: { id } });
  return true;
}

function scopeIdFor(access: BrainAccessContext, scopeType: BehaviorScopeType, requestedScopeId?: string | null) {
  if (scopeType === "user") return access.user.id;
  if (scopeType === "global") return "global";
  if (scopeType === "company") return requestedScopeId ?? Array.from(access.allowedCompanyIds)[0] ?? null;
  if (scopeType === "project") return requestedScopeId ?? Array.from(access.allowedProjectIds)[0] ?? null;
  return null;
}

export async function setBehaviorAssignment(
  access: BrainAccessContext,
  input: { scopeType: unknown; scopeId?: unknown; surface: unknown; profileId: unknown },
) {
  const scopeType = enumValue(input.scopeType, SCOPE_TYPES, "user");
  const surface = enumValue(input.surface, SURFACES, "chat");
  const profileId = asString(input.profileId);
  if (!profileId) throw new Error("profileId e obrigatorio");
  if (!canConfigureBehaviorScope(access, scopeType)) {
    throw new Error("Sem permissao para aplicar perfil de comportamento neste escopo");
  }

  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Perfil de comportamento nao encontrado");

  const scopeId = scopeIdFor(access, scopeType, asString(input.scopeId));
  if (!scopeId) throw new Error("Sem escopo valido para aplicar o perfil de comportamento");

  const { profile: profileDelegate, assignment } = getDelegates();
  if (!assignment?.upsert) throw new BrainBehaviorProfileStorageUnavailableError();

  // Presets do sistema so existem em memoria (SYSTEM_PRESETS); a tabela real exige a
  // linha existir por causa da foreign key da atribuicao. Semeia o preset no banco na
  // primeira vez que ele for de fato usado numa atribuicao. Duas requisicoes concorrentes
  // (ex.: aplicar em "home" e "chat" ao mesmo tempo) podem colidir no insert; a segunda
  // so precisa saber que a linha ja existe, entao P2002 e ignorado aqui.
  if (profile.isSystem) {
    try {
      await profileDelegate.upsert?.({
        where: { id: profile.id },
        update: {},
        create: {
          id: profile.id,
          name: profile.name,
          description: profile.description,
          instructions: profile.instructions,
          tone: profile.tone,
          formality: profile.formality,
          responseLength: profile.responseLength,
          scopeType: "global",
          isSystem: true,
          status: "active",
        },
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== "P2002") throw error;
    }
  }

  const saved = await assignment.upsert({
    where: { scopeType_scopeId_surface: { scopeType, scopeId, surface } },
    update: { profileId, updatedBy: actorId(access) },
    create: { scopeType, scopeId, surface, profileId, updatedBy: actorId(access) },
  });

  return saved;
}

/**
 * Resolve o perfil efetivo para uma superficie (chat, home, resumo, relatorio, audio),
 * seguindo a prioridade usuario > projeto > empresa > global > preset padrao.
 */
export async function resolveEffectiveBehaviorProfile(access: BrainAccessContext, surface: BehaviorSurface) {
  const { assignment } = getDelegates();
  if (!assignment?.findMany) return SYSTEM_PRESETS.find((preset) => preset.id === DEFAULT_BEHAVIOR_PROFILE_ID) ?? null;

  const scopeIdsByType: Record<BehaviorScopeType, string | null> = {
    user: access.user.id,
    project: Array.from(access.allowedProjectIds)[0] ?? null,
    company: Array.from(access.allowedCompanyIds)[0] ?? null,
    global: "global",
  };

  const candidates = SCOPE_PRIORITY
    .filter((scopeType) => scopeIdsByType[scopeType])
    .map((scopeType) => ({ scopeType, scopeId: scopeIdsByType[scopeType] as string }));

  if (!candidates.length) return SYSTEM_PRESETS.find((preset) => preset.id === DEFAULT_BEHAVIOR_PROFILE_ID) ?? null;

  const rows = (await assignment.findMany({
    where: {
      surface,
      OR: candidates.map((candidate) => ({ scopeType: candidate.scopeType, scopeId: candidate.scopeId })),
    },
  }).catch(() => [])) as Array<{ scopeType: string; scopeId: string; profileId: string }>;

  for (const candidate of candidates) {
    const match = rows.find((row) => row.scopeType === candidate.scopeType && row.scopeId === candidate.scopeId);
    if (match) {
      const profile = await getProfileById(match.profileId);
      if (profile) return serializeProfile(profile);
    }
  }

  return serializeProfile(SYSTEM_PRESETS.find((preset) => preset.id === DEFAULT_BEHAVIOR_PROFILE_ID)!);
}
