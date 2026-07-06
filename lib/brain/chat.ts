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
import { buildQaCopilotAnswer } from "@/lib/brain/qaCopilot";
import { buildBrainSystemPrompt, runBrainModel } from "@/lib/brain/modelProvider";
import { brainPrisma } from "@/lib/brain/brainPrisma";
import { shouldUseWebSearch } from "@/lib/brain/webSearch";

export type BrainChatAnswer = {
  answer: string;
  foundNodes: Array<Pick<BrainNode, "id" | "type" | "label" | "description" | "metadata">>;
  suggestedActions: BrainNodeAction[];
  navigation?: { label: string; route: string };
  blocked?: { reason: string; missingPermissions: string[] };
  evidence: Array<{ sourceType: "node" | "edge" | "memory" | "document" | "event"; sourceId: string; label?: string; reason: string }>;
  currentBrainContext: BrainConversationContext;
};

function wantsNavigation(message: string) { return /\b(abre|abrir|entra|entrar|leva|navega|mostrar detalhe|detalhe|dentro)\b/i.test(message); }
function wantsCreation(message: string) { return /\b(cria|criar|gere|gerar|monta|montar|cadastra|cadastrar|salva|salvar|registra|registrar)\b/i.test(message); }
function resolveContextualQuery(message: string, current: BrainConversationContext | null | undefined) { if (!current?.lastNodeId) return message; if (/\b(ele|ela|dele|dela|desse|dessa|esse|essa|isso|no atual|n[oó] atual)\b/i.test(message)) return `${message} ${current.lastNodeId} ${current.lastNodeType ?? ""}`; return message; }
function compact(value: unknown, max = 1800) { const text = String(value ?? "").replace(/\s+/g, " ").trim(); return text.length > max ? `${text.slice(0, max - 1)}...` : text; }
function normalizeQuestion(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function isGeneralQaDefinition(message: string) { return /\b(o que e|o que eh|explique|defina)\b.*\b(qa|quality assurance|analista de qa)\b/.test(normalizeQuestion(message)); }
function buildGeneralQaDefinition() { return "QA é Quality Assurance: a área que ajuda a garantir qualidade antes da entrega. Na prática, QA valida regras de negócio, testa fluxos, registra defeitos com evidência, acompanha correções, apoia regressão, automação e análise de riscos. No Brain, isso pode virar caso de teste, plano, run, bug, automação ou análise, sempre respeitando as permissões do seu perfil."; }
function emptyAnswer(answer: string, current?: BrainConversationContext | null): BrainChatAnswer { return { answer, foundNodes: [], suggestedActions: [], evidence: [], currentBrainContext: current ?? {} }; }

function toChatNode(node: BrainNode, access: BrainAccessContext) {
  const runtime = buildBrainRuntimeContext(access);
  const redacted = redactBrainNodeForUser(runtime, node);
  return { id: redacted.id, type: redacted.type, label: redacted.label, description: redacted.description, metadata: redacted.metadata };
}

function buildModelUserPrompt(input: { message: string; foundNodes: ReturnType<typeof toChatNode>[]; allowedActions: BrainNodeAction[]; qaCopilotAnswer: string }) {
  const nodes = input.foundNodes.slice(0, 5).map((node) => ({ id: node.id, type: node.type, label: node.label, description: node.description, metadata: node.metadata }));
  const actions = input.allowedActions.slice(0, 6).map((action) => ({ id: action.id, label: action.label, type: action.type, route: action.route ?? null, provider: action.provider ?? null }));
  return [
    "Pedido da usuária:",
    input.message,
    "",
    "Contexto seguro vindo do Brain/RAG/banco:",
    compact(JSON.stringify(nodes), 5000),
    "",
    "Ações/integrações disponíveis para favorecer o agente:",
    compact(JSON.stringify(actions), 2000),
    "",
    "Base QA já montada pelo copilot interno:",
    input.qaCopilotAnswer,
    "",
    "Como responder:",
    "- Responda como o Brain da Home: humano, prático, direto e útil.",
    "- Use bom humor leve para animar a pessoa, como um colega inteligente trabalhando junto, mas sem forçar piada.",
    "- Humor permitido: uma frase curta, simpática e contextual. Exemplo de vibe: 'vamos caçar esse bug sem deixar ele virar chefe da sprint'.",
    "- Não use humor quando houver risco, erro crítico, dado sensível, permissão negada, falha de segurança ou decisão séria; nesses casos, seja calmo e objetivo.",
    "- Use todas as camadas disponíveis de forma combinada: Brain/RAG/banco para contexto interno, permissões para segurança, ações/rotas para próximo passo, templates QA para estrutura e API externa gratuita quando o provedor estiver disponível.",
    "- Não despeje JSON, IDs técnicos, listas enormes, logs crus ou texto de segurança repetitivo.",
    "- Explique o que você entendeu, o contexto que encontrou e a melhor ação agora.",
    "- Quando não houver contexto forte, não finja certeza: diga o que falta e peça exatamente uma informação útil para continuar.",
    "- Se o pedido envolver criação ou alteração real, prepare o rascunho e peça confirmação antes de gravar.",
    "- Se houver rota ou ação segura, ofereça abrir/executar como próximo passo; não navegue sem intenção clara.",
    "- Prefira frases curtas e tom de apoio, como alguém trabalhando junto com a usuária.",
  ].join("\n");
}

export async function answerBrainChatQuestion(input: { message: string; access: BrainAccessContext; currentBrainContext?: BrainConversationContext | null; limit?: number }): Promise<BrainChatAnswer> {
  const query = resolveContextualQuery(input.message, input.currentBrainContext);

  if (shouldUseWebSearch(input.message)) {
    return emptyAnswer("Detectei que essa pergunta precisa de informação externa ou atual. Vou usar a camada de busca web configurada e combinar com o Brain quando fizer sentido.", input.currentBrainContext);
  }

  if (isGeneralQaDefinition(input.message)) return emptyAnswer(buildGeneralQaDefinition(), input.currentBrainContext);

  const [nodes, edges] = await Promise.all([
    brainPrisma.brainNode.findMany({ orderBy: { updatedAt: "desc" }, take: 220 }),
    brainPrisma.brainEdge.findMany({ take: 450 }),
  ]);
  const visibility = filterBrainGraphByAccess(nodes, edges, input.access);
  const visibleNodes = nodes.filter((node) => visibility.visibleNodeIds.has(node.id));
  const visibleEdges = edges.filter((edge) => visibility.visibleEdgeIds.has(edge.id));
  const index = buildBrainSearchIndex(visibleNodes, visibleEdges);
  const results = searchBrainIndex(index, query, { limit: input.limit ?? 4, currentNodeId: input.currentBrainContext?.lastNodeId, currentModuleId: input.currentBrainContext?.lastNodeType });

  if (!results.length) {
    await recordBrainAuditEvent({ userId: input.access.user.id, profile: input.access.userAccess.permissionRole ?? input.access.userAccess.role, companyId: input.access.userAccess.companyId, action: "assistant.brain.search.empty", allowed: true, reason: "no_results", metadata: { query: input.message } });
    const qaCopilotAnswer = buildQaCopilotAnswer({ message: input.message, foundNodes: [], allowedActions: [] });
    const model = await runBrainModel({ messages: [{ role: "system", content: buildBrainSystemPrompt() }, { role: "user", content: buildModelUserPrompt({ message: input.message, foundNodes: [], allowedActions: [], qaCopilotAnswer }) }], temperature: 0.2, maxTokens: 1000 });
    const creationHint = wantsCreation(input.message) ? "\n\nPosso preparar isso, mas preciso saber onde criar: empresa, projeto, módulo, tela, repositório ou integração. Antes de gravar qualquer coisa, eu peço confirmação." : "";
    return { answer: `${model.provider === "mock" ? qaCopilotAnswer : model.text}${creationHint}`, foundNodes: [], suggestedActions: [], evidence: [], currentBrainContext: input.currentBrainContext ?? {} };
  }

  const resultIds = new Set(results.map((result) => result.nodeId));
  const foundNodes = visibleNodes.filter((node) => resultIds.has(node.id));
  const mainNode = foundNodes.find((node) => node.id === results[0]?.nodeId) ?? foundNodes[0];
  const actions = mainNode ? buildBrainNodeActions(mainNode) : [];
  const allowedActions = actions.filter((action) => input.access.user.isGlobalAdmin || action.requiredPermissions.length === 0 || action.requiredPermissions.some((permission) => input.access.userAccess.permissions[permission.moduleId]?.includes(permission.action)));
  const navigationAction = allowedActions.find((action) => action.route && (action.id === "open" || action.id === "navigate" || action.id === "open_external"));
  const blockedAction = actions.find((action) => !allowedActions.includes(action));
  const currentBrainContext: BrainConversationContext = mainNode ? { lastNodeId: mainNode.id, lastNodeType: mainNode.type, lastCompanyId: typeof (mainNode.metadata as Record<string, unknown> | null)?.companyId === "string" ? String((mainNode.metadata as Record<string, unknown>).companyId) : input.access.userAccess.companyId, lastProjectId: typeof (mainNode.metadata as Record<string, unknown> | null)?.projectId === "string" ? String((mainNode.metadata as Record<string, unknown>).projectId) : null, lastRoute: navigationAction?.route ?? null, lastIntent: wantsNavigation(input.message) ? "navigate" : "search" } : input.currentBrainContext ?? {};
  await recordBrainAuditEvent({ userId: input.access.user.id, profile: input.access.userAccess.permissionRole ?? input.access.userAccess.role, companyId: input.access.userAccess.companyId, action: "assistant.brain.search", nodeId: mainNode?.id, allowed: Boolean(mainNode && isBrainNodeVisible(mainNode, input.access)), reason: "brain_index_result", metadata: { query: input.message, results: results.map((result) => ({ nodeId: result.nodeId, score: result.score, matchedBy: result.matchedBy })) } });
  const safeFoundNodes = foundNodes.slice(0, input.limit ?? 4).map((node) => toChatNode(node, input.access));
  const qaCopilotAnswer = buildQaCopilotAnswer({ message: input.message, foundNodes: foundNodes.slice(0, input.limit ?? 4), allowedActions });
  const model = await runBrainModel({ messages: [{ role: "system", content: buildBrainSystemPrompt() }, { role: "user", content: buildModelUserPrompt({ message: input.message, foundNodes: safeFoundNodes, allowedActions, qaCopilotAnswer }) }], temperature: 0.2, maxTokens: 1300 });
  const topLabels = foundNodes.slice(0, 3).map((node) => `${node.label} (${node.type})`).join(", ");
  const navSentence = navigationAction?.route && wantsNavigation(input.message) ? ` Posso abrir ${navigationAction.route}.` : "";
  const createSentence = wantsCreation(input.message) ? " Posso montar o rascunho com o contexto encontrado; antes de gravar, confirmo com você." : "";
  const blockedSentence = blockedAction ? ` Algumas ações existem, mas ficam bloqueadas para seu perfil, como "${blockedAction.label}".` : "";
  const modelAnswer = model.provider === "mock" ? qaCopilotAnswer : model.text;
  return { answer: [`Achei contexto útil no Brain: ${topLabels}.${navSentence}${createSentence}${blockedSentence}`, modelAnswer].join("\n\n"), foundNodes: safeFoundNodes, suggestedActions: allowedActions, navigation: navigationAction?.route ? { label: navigationAction.label, route: navigationAction.route } : undefined, blocked: blockedAction ? { reason: "missing_permission", missingPermissions: blockedAction.requiredPermissions.map((permission) => `${permission.moduleId}:${permission.action}`) } : undefined, evidence: results.slice(0, 5).map((result) => ({ sourceType: "node", sourceId: result.nodeId, label: result.label, reason: `match: ${result.matchedBy.join(", ") || "index"}` })), currentBrainContext };
}
