import { prisma } from "@/lib/prismaClient";
import { getBrainGaps, getSubgraph, searchNodes, traceImpact } from "@/lib/brain";
import { BrainGraphAnalyticsService } from "@/lib/brain/graphAnalyticsService";
import type { BrainAccessContext } from "@/lib/brain/access";
import { BRAIN_COMMAND_CATALOG, getBrainCommandDefinition, type BrainCommandDefinition } from "@/lib/brain/commandCatalog";
import { runAllGuardrails, scopeGuardrail } from "@/lib/brain/guardrails";

export type ParsedBrainCommand = {
  command: string;
  args: string[];
  params: Record<string, string>;
  naturalInput?: string;
  definition?: BrainCommandDefinition;
};

export type BrainCommandExecutionResult = {
  ok: boolean;
  command: ParsedBrainCommand;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  actionType: "read_only" | "suggestion" | "draft" | "write" | "destructive" | "external_publish";
  result?: unknown;
  error?: string;
};

const NATURAL_COMMAND_MAPPINGS: Array<{
  test: RegExp;
  command: string;
  build: (input: string) => ParsedBrainCommand;
}> = [
  {
    test: /ligad[oa].*caso|expandir|vizinhan[cÃ§]a/i,
    command: "/expandir",
    build: (input) => {
      const match = input.match(/(TC-[A-Za-z0-9_-]+)/i);
      return { command: "/expandir", args: [match?.[1] ?? ""], params: { depth: "2" }, naturalInput: input };
    },
  },
  {
    test: /impacto/i,
    command: "/impacto",
    build: (input) => {
      const id = input.match(/([A-Z]{2,}-[A-Za-z0-9_-]+)/i)?.[1] ?? "";
      return { command: "/impacto", args: [id], params: {}, naturalInput: input };
    },
  },
  {
    test: /lacunas|gaps/i,
    command: "/lacunas",
    build: (input) => {
      const slug = input.match(/\b([a-z][a-z0-9-]{2,})\b/i)?.[1] ?? "";
      return { command: "/lacunas", args: slug ? [slug] : [], params: {}, naturalInput: input };
    },
  },
];

function parseStructuredCommand(text: string): ParsedBrainCommand {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  let command = parts[0].toLowerCase();
  let cursor = 1;

  const alias = `${parts[0]} ${parts[1] ?? ""} ${parts[2] ?? ""} ${parts[3] ?? ""}`.trim().toLowerCase();
  const twoTokens = `${parts[0]} ${parts[1] ?? ""}`.trim().toLowerCase();
  const threeTokens = `${parts[0]} ${parts[1] ?? ""} ${parts[2] ?? ""}`.trim().toLowerCase();
  const aliasMap: Record<string, { command: string; consumedTokens: number }> = {
    "/mostrar scripts quebrados": { command: "/mostrar-scripts-quebrados", consumedTokens: 3 },
    "/mostrar casos sem automacao": { command: "/mostrar-casos-sem-automacao", consumedTokens: 4 },
    "/mostrar usuarios sem empresa": { command: "/mostrar-usuarios-sem-empresa", consumedTokens: 4 },
    "/mostrar defeitos sem run": { command: "/mostrar-defeitos-sem-run", consumedTokens: 4 },
    "/gerar-relatorio brain": { command: "/gerar-relatorio-brain", consumedTokens: 2 },
    "/arquivar memoria": { command: "/arquivar-memoria", consumedTokens: 2 },
    "/mesclar nos": { command: "/mesclar-nos", consumedTokens: 2 },
  };

  if (aliasMap[alias]) {
    command = aliasMap[alias].command;
    cursor = aliasMap[alias].consumedTokens;
  } else if (aliasMap[threeTokens]) {
    command = aliasMap[threeTokens].command;
    cursor = aliasMap[threeTokens].consumedTokens;
  } else if (aliasMap[twoTokens]) {
    command = aliasMap[twoTokens].command;
    cursor = aliasMap[twoTokens].consumedTokens;
  }

  const args: string[] = [];
  const params: Record<string, string> = {};

  for (const token of parts.slice(cursor)) {
    if (token.includes("=")) {
      const [key, value] = token.split("=");
      if (key && value) params[key] = value;
    } else {
      args.push(token);
    }
  }

  return {
    command,
    args,
    params,
    definition: getBrainCommandDefinition(command),
  };
}

export function interpretBrainCommand(input: string): ParsedBrainCommand {
  const text = String(input ?? "").trim();
  if (!text) return { command: "", args: [], params: {} };

  if (text.startsWith("/")) {
    const parsed = parseStructuredCommand(text);
    return { ...parsed, definition: getBrainCommandDefinition(parsed.command) };
  }

  const mapping = NATURAL_COMMAND_MAPPINGS.find((item) => item.test.test(text));
  if (mapping) {
    const parsed = mapping.build(text);
    return { ...parsed, definition: getBrainCommandDefinition(parsed.command) };
  }

  return { command: "", args: [], params: {}, naturalInput: text };
}

function resolvePermissions(access: BrainAccessContext) {
  const roles = [access.user.role, access.user.companyRole, access.user.permissionRole]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);

  const permissions = new Set<string>(["brain:read"]);
  if (access.hasGlobalVisibility) {
    permissions.add("brain:read-sensitive");
    permissions.add("brain:write");
    permissions.add("brain:reindex");
    permissions.add("brain:publish");
  }

  if (roles.includes("testing_company_user") || roles.includes("company_user") || roles.includes("empresa")) {
    permissions.add("brain:draft");
  }

  return permissions;
}

function resolveActionType(command: string): BrainCommandExecutionResult["actionType"] {
  if (["/reindexar", "/mesclar-nos"].includes(command)) return "destructive";
  if (["/memorizar", "/arquivar-memoria"].includes(command)) return "write";
  if (["/gerar-relatorio-brain"].includes(command)) return "draft";
  return "read_only";
}

export async function executeBrainCommand(input: {
  rawInput: string;
  parsed: ParsedBrainCommand;
  access: BrainAccessContext;
  confirmed?: boolean;
}) : Promise<BrainCommandExecutionResult> {
  const guardrails = runAllGuardrails(input.rawInput);
  if (!guardrails.allowed) {
    return {
      ok: false,
      command: input.parsed,
      requiresConfirmation: false,
      actionType: "read_only",
      error: guardrails.blocked?.reason ?? "Comando bloqueado por guardrail.",
    };
  }

  const definition = input.parsed.definition;
  if (!definition) {
    return {
      ok: false,
      command: input.parsed,
      requiresConfirmation: false,
      actionType: "read_only",
      error: "Comando nÃ£o reconhecido no catÃ¡logo oficial do Brain.",
    };
  }

  const permissions = resolvePermissions(input.access);
  if (!permissions.has(definition.requiredPermission)) {
    return {
      ok: false,
      command: input.parsed,
      requiresConfirmation: false,
      actionType: resolveActionType(definition.command),
      error: `PermissÃ£o insuficiente: ${definition.requiredPermission}`,
    };
  }

  const requestedScope = input.parsed.args[0];
  const scopeCheck = scopeGuardrail({
    requestedCompanySlug: requestedScope,
    allowedCompanySlugs: input.access.allowedCompanySlugs,
    hasGlobalVisibility: input.access.hasGlobalVisibility,
  });
  if (!scopeCheck.allowed && definition.allowedScopes?.includes("company")) {
    return {
      ok: false,
      command: input.parsed,
      requiresConfirmation: false,
      actionType: resolveActionType(definition.command),
      error: scopeCheck.reason,
    };
  }

  const requiresConfirmation = definition.requiresConfirmation;
  if (requiresConfirmation && !input.confirmed) {
    return {
      ok: true,
      command: input.parsed,
      requiresConfirmation: true,
      confirmationMessage: `Confirme execuÃ§Ã£o de ${definition.command} (risco ${definition.risk}).`,
      actionType: resolveActionType(definition.command),
      result: { preview: true },
    };
  }

  try {
    const analytics = new BrainGraphAnalyticsService();
    const command = definition.command;

    if (command === "/focar") {
      const query = input.parsed.args[0];
      const nodes = await searchNodes({ query, limit: 5 });
      return {
        ok: true,
        command: input.parsed,
        requiresConfirmation: false,
        actionType: "read_only",
        result: { focusCandidates: nodes },
      };
    }

    if (command === "/expandir") {
      const query = input.parsed.args[0];
      const depth = Math.min(4, Math.max(1, Number(input.parsed.params.depth ?? "2")));
      const node = (await searchNodes({ query, limit: 1 }))[0];
      if (!node) throw new Error("Entidade nÃ£o encontrada para expansÃ£o.");
      const graph = await getSubgraph(node.id, depth);
      return {
        ok: true,
        command: input.parsed,
        requiresConfirmation: false,
        actionType: "read_only",
        result: { node, depth, graph },
      };
    }

    if (command === "/explicar-relacao") {
      const from = (await searchNodes({ query: input.parsed.args[0], limit: 1 }))[0];
      const to = (await searchNodes({ query: input.parsed.args[1], limit: 1 }))[0];
      if (!from || !to) throw new Error("Entidades nÃ£o encontradas para explicaÃ§Ã£o de relaÃ§Ã£o.");
      const path = await analytics.calculatePath(from.id, to.id);
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "read_only", result: path };
    }

    if (command === "/investigar") {
      const query = input.parsed.args[0];
      const context = await searchNodes({ query, limit: 10 });
      return {
        ok: true,
        command: input.parsed,
        requiresConfirmation: false,
        actionType: "read_only",
        result: { query, related: context },
      };
    }

    if (command === "/impacto") {
      const node = (await searchNodes({ query: input.parsed.args[0], limit: 1 }))[0];
      if (!node) throw new Error("Entidade nÃ£o encontrada para impacto.");
      const impact = await traceImpact(node.id, 3);
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "read_only", result: impact };
    }

    if (command === "/lacunas") {
      const companySlug = input.parsed.args[0];
      const gaps = await getBrainGaps({ companySlug: companySlug || undefined, sampleSize: 20 });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "read_only", result: gaps };
    }

    if (command === "/reindexar") {
      const result = await analytics.recalculateNodeScores({ companySlug: input.parsed.args[1] ?? undefined });
      return {
        ok: true,
        command: input.parsed,
        requiresConfirmation: false,
        actionType: "destructive",
        result: { message: "ReindexaÃ§Ã£o lÃ³gica executada (recalcular scores).", updated: result.updated },
      };
    }

    if (command === "/memorizar") {
      const title = input.rawInput.replace(/^\/memorizar\s*/i, "").trim() || "MemÃ³ria operacional";
      const memory = await prisma.brainMemory.create({
        data: {
          title,
          summary: title,
          memoryType: "DECISION",
          importance: 2,
          sourceType: "MANUAL",
          status: "ACTIVE",
          metadata: { createdBy: input.access.user.id, sourceContract: "manual_note" },
        },
      });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "write", result: memory };
    }

    if (command === "/arquivar-memoria") {
      const memoryId = input.parsed.args[0];
      const updated = await prisma.brainMemory.update({ where: { id: memoryId }, data: { status: "ARCHIVED" } });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "write", result: updated };
    }

    if (command === "/mesclar-nos") {
      const [nodeA, nodeB] = input.parsed.args;
      const a = (await searchNodes({ query: nodeA, limit: 1 }))[0];
      const b = (await searchNodes({ query: nodeB, limit: 1 }))[0];
      if (!a || !b) throw new Error("NÃ³s nÃ£o encontrados para mesclagem.");
      const suggestion = await prisma.brainInboxItem.create({
        data: {
          kind: "duplicate",
          status: "pending",
          title: "SolicitaÃ§Ã£o de mesclagem de nÃ³s",
          summary: `Mesclar ${a.label} (${a.id}) com ${b.label} (${b.id})`,
          payload: { nodeA: a.id, nodeB: b.id, requestedBy: input.access.user.id },
        },
      });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "destructive", result: suggestion };
    }

    if (command === "/mostrar-scripts-quebrados") {
      const scripts = await prisma.brainNode.findMany({
        where: {
          type: "AutomationScript",
          OR: [
            { metadata: { path: ["status"], equals: "broken" } },
            { metadata: { path: ["flakiness"], equals: "high" } },
          ],
        },
        take: 100,
      });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "read_only", result: scripts };
    }

    if (command === "/mostrar-casos-sem-automacao") {
      const gaps = await getBrainGaps({ sampleSize: 100 });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "read_only", result: gaps.samples.casesWithoutAutomation };
    }

    if (command === "/mostrar-usuarios-sem-empresa") {
      const users = await prisma.user.findMany({
        where: { memberships: { none: {} } },
        take: 100,
        select: { id: true, name: true, email: true, role: true },
      });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "read_only", result: users };
    }

    if (command === "/mostrar-defeitos-sem-run") {
      const gaps = await getBrainGaps({ sampleSize: 100 });
      return { ok: true, command: input.parsed, requiresConfirmation: false, actionType: "read_only", result: gaps.samples.defectsWithoutRun };
    }

    if (command === "/gerar-relatorio-brain") {
      const [stats, pending, centrality] = await Promise.all([
        prisma.brainNode.count(),
        prisma.brainInboxItem.count({ where: { status: "pending" } }),
        analytics.calculateCentrality({ limit: 10 }),
      ]);
      return {
        ok: true,
        command: input.parsed,
        requiresConfirmation: false,
        actionType: "draft",
        result: {
          generatedAt: new Date().toISOString(),
          totalNodes: stats,
          pendingInbox: pending,
          topEntities: centrality,
        },
      };
    }

    throw new Error("Comando sem executor implementado.");
  } catch (error) {
    return {
      ok: false,
      command: input.parsed,
      requiresConfirmation: false,
      actionType: resolveActionType(definition.command),
      error: error instanceof Error ? error.message : "Falha ao executar comando.",
    };
  }
}

export function listBrainCommands() {
  return BRAIN_COMMAND_CATALOG;
}

