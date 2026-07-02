import "server-only";

import type { BrainNode } from "@prisma/client";

import type { BrainAccessContext } from "@/lib/brain/access";
import { filterBrainGraphByAccess, isBrainNodeVisible } from "@/lib/brain/access";
import { buildBrainNodeActions, type BrainNodeAction } from "@/lib/brain/actions";
import { recordBrainAuditEvent } from "@/lib/brain/audit";
import type { BrainConversationContext } from "@/lib/brain/runtime";
import { buildBrainRuntimeContext } from "@/lib/brain/runtime";
import { redactBrainNodeForUser } from "@/lib/brain/redaction";
import { buildBrainSearchIndex, searchBrainIndex } from "@/lib/brain/searchIndex";
import { prisma } from "@/lib/prismaClient";

export type BrainChatAnswer = {
  answer: string;
  foundNodes: Array<Pick<BrainNode, "id" | "type" | "label" | "description" | "metadata">>;
  suggestedActions: BrainNodeAction[];
  navigation?: {
    label: string;
    route: string;
  };
  blocked?: {
    reason: string;
    missingPermissions: string[];
  };
  evidence: Array<{
    sourceType: "node" | "edge" | "memory" | "document" | "event";
    sourceId: string;
    label?: string;
    reason: string;
  }>;
  currentBrainContext: BrainConversationContext;
};

function wantsNavigation(message: string) {
  return /\b(abre|abrir|entra|entrar|leva|navega|mostrar detalhe|detalhe|dentro)\b/i.test(message);
}

function resolveContextualQuery(message: string, current: BrainConversationContext | null | undefined) {
  if (!current?.lastNodeId) return message;
  if (/\b(ele|ela|dele|dela|desse|dessa|esse|essa|isso|no atual|n[oÃ³] atual)\b/i.test(message)) {
    return `${message} ${current.lastNodeId} ${current.lastNodeType ?? ""}`;
  }
  return message;
}

function toChatNode(node: BrainNode, access: BrainAccessContext) {
  const runtime = buildBrainRuntimeContext(access);
  const redacted = redactBrainNodeForUser(runtime, node);
  return {
    id: redacted.id,
    type: redacted.type,
    label: redacted.label,
    description: redacted.description,
    metadata: redacted.metadata,
  };
}

export async function answerBrainChatQuestion(input: {
  message: string;
  access: BrainAccessContext;
  currentBrainContext?: BrainConversationContext | null;
  limit?: number;
}): Promise<BrainChatAnswer> {
  const query = resolveContextualQuery(input.message, input.currentBrainContext);
  const [nodes, edges] = await Promise.all([
    prisma.brainNode.findMany({ orderBy: { updatedAt: "desc" }, take: 600 }),
    prisma.brainEdge.findMany({ take: 1200 }),
  ]);
  const visibility = filterBrainGraphByAccess(nodes, edges, input.access);
  const visibleNodes = nodes.filter((node) => visibility.visibleNodeIds.has(node.id));
  const visibleEdges = edges.filter((edge) => visibility.visibleEdgeIds.has(edge.id));
  const index = buildBrainSearchIndex(visibleNodes, visibleEdges);
  const results = searchBrainIndex(index, query, {
    limit: input.limit ?? 5,
    currentNodeId: input.currentBrainContext?.lastNodeId,
    currentModuleId: input.currentBrainContext?.lastNodeType,
  });

  if (!results.length) {
    await recordBrainAuditEvent({
      userId: input.access.user.id,
      profile: input.access.userAccess.permissionRole ?? input.access.userAccess.role,
      companyId: input.access.userAccess.companyId,
      action: "assistant.brain.search.empty",
      allowed: true,
      reason: "no_results",
      metadata: { query: input.message },
    });

    return {
      answer: "Nao encontrei esse no no Brain. Posso procurar por empresa, projeto, run, defeito, tela, permissao ou usuario relacionado.",
      foundNodes: [],
      suggestedActions: [],
      evidence: [],
      currentBrainContext: input.currentBrainContext ?? {},
    };
  }

  const resultIds = new Set(results.map((result) => result.nodeId));
  const foundNodes = visibleNodes.filter((node) => resultIds.has(node.id));
  const mainNode = foundNodes.find((node) => node.id === results[0]?.nodeId) ?? foundNodes[0];
  const actions = mainNode ? buildBrainNodeActions(mainNode) : [];
  const allowedActions = actions.filter((action) => {
    if (input.access.user.isGlobalAdmin) return true;
    return action.requiredPermissions.length === 0 || action.requiredPermissions.some((permission) =>
      input.access.userAccess.permissions[permission.moduleId]?.includes(permission.action),
    );
  });
  const navigationAction = allowedActions.find((action) => action.route && (action.id === "open" || action.id === "navigate" || action.id === "open_external"));
  const blockedAction = actions.find((action) => !allowedActions.includes(action));
  const currentBrainContext: BrainConversationContext = mainNode
    ? {
        lastNodeId: mainNode.id,
        lastNodeType: mainNode.type,
        lastCompanyId: typeof (mainNode.metadata as Record<string, unknown> | null)?.companyId === "string"
          ? String((mainNode.metadata as Record<string, unknown>).companyId)
          : input.access.userAccess.companyId,
        lastProjectId: typeof (mainNode.metadata as Record<string, unknown> | null)?.projectId === "string"
          ? String((mainNode.metadata as Record<string, unknown>).projectId)
          : null,
        lastRoute: navigationAction?.route ?? null,
        lastIntent: wantsNavigation(input.message) ? "navigate" : "search",
      }
    : input.currentBrainContext ?? {};

  await recordBrainAuditEvent({
    userId: input.access.user.id,
    profile: input.access.userAccess.permissionRole ?? input.access.userAccess.role,
    companyId: input.access.userAccess.companyId,
    action: "assistant.brain.search",
    nodeId: mainNode?.id,
    allowed: Boolean(mainNode && isBrainNodeVisible(mainNode, input.access)),
    reason: "brain_index_result",
    metadata: {
      query: input.message,
      results: results.map((result) => ({ nodeId: result.nodeId, score: result.score, matchedBy: result.matchedBy })),
    },
  });

  const topLabels = foundNodes.slice(0, 3).map((node) => `${node.label} (${node.type})`).join(", ");
  const navSentence = navigationAction?.route && wantsNavigation(input.message)
    ? ` Posso abrir: ${navigationAction.route}.`
    : "";
  const blockedSentence = blockedAction
    ? ` Algumas acoes ficam bloqueadas para seu perfil, como "${blockedAction.label}".`
    : "";

  return {
    answer: `Encontrei no Brain: ${topLabels}.${navSentence}${blockedSentence}`,
    foundNodes: foundNodes.slice(0, input.limit ?? 5).map((node) => toChatNode(node, input.access)),
    suggestedActions: allowedActions,
    navigation: navigationAction?.route ? { label: navigationAction.label, route: navigationAction.route } : undefined,
    blocked: blockedAction
      ? {
          reason: "missing_permission",
          missingPermissions: blockedAction.requiredPermissions.map((permission) => `${permission.moduleId}:${permission.action}`),
        }
      : undefined,
    evidence: results.slice(0, 5).map((result) => ({
      sourceType: "node",
      sourceId: result.nodeId,
      label: result.label,
      reason: `match: ${result.matchedBy.join(", ") || "index"}`,
    })),
    currentBrainContext,
  };
}

