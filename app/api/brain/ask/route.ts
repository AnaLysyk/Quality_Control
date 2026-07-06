import { type NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import type { AgentMode } from "@/lib/brain/agents";
import { runAllGuardrails } from "@/lib/brain/guardrails";
import { buildMockBrainGraph } from "@/brain/_data/brainMockGraph";
import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { filterBrainDomainGraphByAccess, resolveBrainAccess } from "@/lib/brain/access";
import { answerBrainChatQuestion } from "@/lib/brain/chat";
import { formatWebSearchForBrain, searchBrainWeb, shouldUseWebSearch } from "@/lib/brain/webSearch";

type BrainWeatherContext = { place?: string; temperature?: number | null; apparentTemperature?: number | null; humidity?: number | null; precipitation?: number | null; windSpeed?: number | null; label?: string; comment?: string; source?: string };

function isE2eJsonMode() { return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true"; }
function normalizeForBrain(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function isSmallTalk(message: string) { const text = normalizeForBrain(message).replace(/[!.?,;:]+/g, " ").replace(/\s+/g, " ").trim(); return /^(oi|ola|olá|e ai|e aí|bom dia|boa tarde|boa noite|tudo bem|como vai|como voce esta|como você está|valeu|obrigada|obrigado)( brian| brain)?$/.test(text); }
function wantsTechJoke(message: string) { const text = normalizeForBrain(message); return /\b(piada|brincadeira|engracado|engraçado)\b/.test(text) && /\b(tecnologia|dev|programacao|programação|qa|teste|bug|sistema)\b/.test(text); }
function wantsWeatherComment(message: string) { const text = normalizeForBrain(message); return /\b(clima|tempo|temperatura|previsao|previsão|chuva|frio|calor)\b/.test(text); }
function extractWeatherContext(filters: Record<string, unknown> | undefined): BrainWeatherContext | null { const weather = filters?.weather as BrainWeatherContext | null | undefined; return typeof weather?.comment === "string" && weather.comment.trim() ? weather : null; }
function buildTechJokeReply() { return "Claro 😄 Por que o QA atravessou a rua? Para testar se o fluxo de pedestre também quebrava em produção. Quer que eu te conte outra ou seguimos para o trabalho?"; }
function buildSmallTalkReply(weatherContext: BrainWeatherContext | null) { return ["Oi, Ana! Estou online, acordado e com o radar de bugs ligado 😄", weatherContext?.comment ?? null, "Posso investigar erro, resumir contexto, montar bug, gerar caso de teste ou validar permissão.", "Me manda o módulo, empresa, usuário, ticket ou erro que eu entro contigo nessa missão."].filter(Boolean).join("\n\n"); }
function isHomeSummaryRequest(body: { activeContext?: { module?: string | null }; visibleFilters?: Record<string, unknown> }) { const filters = body.visibleFilters ?? {}; return body.activeContext?.module === "home" || filters.route === "/admin/home" || filters.responseStyle === "short-home-summary"; }
function compactHomeReply(reply: string) { const withoutNoise = reply.replace(/\n{3,}/g, "\n\n").replace(/Posso ajudar com:[\s\S]*?(?=\n\nAções seguras|\n\nSegurança|$)/gi, "").replace(/Ações seguras disponíveis para seu perfil:[\s\S]*?(?=\n\nSegurança|$)/gi, "").replace(/Segurança: eu consulto[\s\S]*$/gi, "").replace(/Vou te apoiar em modo QA:\s*Apoio QA geral\.\s*Ajuda a investigar, explicar, documentar, validar e decidir próximo passo\./gi, "Posso te apoiar em investigação, bug, caso de teste, regressão ou validação de permissão.").trim(); if (withoutNoise.length <= 900) return withoutNoise; return `${withoutNoise.slice(0, 900).trim()}...\n\nResumo completo aberto no painel lateral para continuar sem poluir a home.`; }
function shouldTryWebFallback(message: string, foundNodes: number) { if (shouldUseWebSearch(message)) return true; if (foundNodes > 0 || isSmallTalk(message) || wantsTechJoke(message)) return false; const text = normalizeForBrain(message); if (text.split(/\s+/).filter(Boolean).length < 3) return false; return /\b(quem|qual|quando|onde|como|porque|por que|o que|me explica|sabe|conhece)\b/.test(text); }
function humanizeBrainReply(input: { message: string; baseReply: string; foundNodes: number; pendingCount: number; webContext: string | null; webEnabled: boolean; homeSummary: boolean; weatherContext: BrainWeatherContext | null }) {
  if (wantsTechJoke(input.message)) return buildTechJokeReply();
  if (wantsWeatherComment(input.message) && input.weatherContext?.comment) return input.homeSummary ? compactHomeReply(input.weatherContext.comment) : input.weatherContext.comment;
  if (input.webContext) { const intro = input.webEnabled ? "Procurei no Brain e complementei com busca externa porque a pergunta dependia de informação atual." : "Procurei no Brain. Para completar com internet, falta configurar a chave de busca do ambiente."; return input.homeSummary ? compactHomeReply(`${intro}\n\n${input.webContext}`) : `${intro}\n\n${input.webContext}`; }
  if (input.foundNodes > 0) { const reply = input.baseReply.replace(/^Encontrei no Brain:/, "Encontrei isso no Brain:").replace(/^Achei contexto útil no Brain:/, "Achei um caminho bom no Brain:").replace(/Modo QA ativado:/g, "Modo QA:"); return input.homeSummary ? compactHomeReply(reply) : reply; }
  if (isSmallTalk(input.message)) return buildSmallTalkReply(input.weatherContext);
  const fallback = ["Não achei contexto interno forte o suficiente para responder com segurança.", input.pendingCount ? `Há ${input.pendingCount} pendência(s) de contexto nesse recorte.` : null, "Me diga o módulo, empresa, usuário, ticket ou erro. Daí eu consigo investigar, explicar a regra, montar bug, criar caso de teste ou sugerir automação."].filter(Boolean).join("\n\n");
  return input.homeSummary ? compactHomeReply(fallback) : fallback;
}

export async function POST(req: NextRequest) {
  const lightweightBody = (await req.clone().json().catch(() => ({}))) as { message?: string; selectedNodeId?: string | null; activeContext?: { module?: string | null }; visibleFilters?: Record<string, unknown> };
  if (typeof lightweightBody.message === "string") {
    const accessResult = await resolveBrainAccess(req);
    if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    const graph = buildMockBrainGraph();
    const visibleGraph = filterBrainDomainGraphByAccess(graph.nodes, graph.edges, accessResult.context);
    const text = normalizeBrainText(lightweightBody.message);
    const moduleName = lightweightBody.activeContext?.module ?? null;
    const homeSummary = isHomeSummaryRequest(lightweightBody);
    const weatherContext = extractWeatherContext(lightweightBody.visibleFilters);
    const visibleNodes = visibleGraph.nodes.filter((node) => { if (moduleName && node.module !== moduleName) return false; return true; });
    const connectedNodeIds = new Set(visibleGraph.edges.flatMap((edge) => [edge.source, edge.target]));
    const visibleOrphanCount = visibleNodes.filter((node) => !connectedNodeIds.has(node.id)).length;
    const pending = visibleNodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status));
    const pendingMappings = visibleNodes.flatMap((node) => node.missingKnowledge ?? []);
    const selectedNode = visibleNodes.find((node) => node.id === lightweightBody.selectedNodeId) ?? null;

    if (/\borfaos?\b/.test(text)) return NextResponse.json({ reply: `Filtrei os nós órfãos do contexto. Encontrei ${visibleOrphanCount} nó(s) sem conexão suficiente.`, action: "show_orphans", filters: { onlyOrphans: true }, suggestedActions: ["Mostrar pendências", "Ver tudo que tenho acesso"], requiresConfirmation: false });
    if (/\bpendencias?\b|\bfalta mapear\b/.test(text)) return NextResponse.json({ reply: `No contexto ${moduleName ?? "geral"}, encontrei ${pending.length} pendência(s). Principais pontos: ${pendingMappings.slice(0, 4).join("; ") || "sem pendências críticas no fallback"}.`, action: "show_pending", filters: { onlyPending: true }, suggestedActions: ["Explicar no selecionado", "Atualizar grafo"], requiresConfirmation: false });
    if (/\bexplica\b|\binformacao\b/.test(text) && selectedNode) return NextResponse.json({ reply: selectedNode.information ?? `${selectedNode.label} ainda precisa de mais conexões para formar uma informação completa.`, action: "explain_node", selectedNodeId: selectedNode.id, suggestedActions: ["Mostrar grafo local", "Expandir conexões"], requiresConfirmation: false });
    if (/\bsolicitacoes?\b|\bacesso\b/.test(text)) return NextResponse.json({ reply: "Apliquei o recorte de Solicitações. Esse módulo mostra pedidos, solicitantes, perfis, status, logs, e-mails e decisões quando permitidos pelo seu perfil.", action: "filter_context", filters: { module: "Solicitacoes" }, suggestedActions: ["Mostrar pendências desse projeto", "Abrir solicitações de acesso"], requiresConfirmation: false });

    const brainAnswer = await answerBrainChatQuestion({ message: lightweightBody.message, access: accessResult.context, currentBrainContext: selectedNode ? { lastNodeId: selectedNode.id, lastNodeType: selectedNode.type, lastCompanyId: selectedNode.companyId ?? null, lastProjectId: selectedNode.projectId ?? null, lastRoute: null, lastIntent: "inspect" } : null });
    const weatherAlreadyAnswers = Boolean(weatherContext?.comment && wantsWeatherComment(lightweightBody.message));
    const needsWebSearch = weatherAlreadyAnswers ? false : shouldTryWebFallback(lightweightBody.message, brainAnswer.foundNodes.length);
    const webSearch = needsWebSearch ? await searchBrainWeb(lightweightBody.message).catch((error) => ({ enabled: false, provider: "none" as const, query: lightweightBody.message ?? "", results: [], warning: `Busca web indisponível agora: ${String(error)}` })) : null;
    const webContext = webSearch ? formatWebSearchForBrain(webSearch) : null;
    const fallbackReply = `Procurei no Brain e encontrei ${visibleNodes.length} nó(s), ${visibleGraph.edges.length} conexão(ões) e ${pending.length} pendência(s) neste recorte.`;
    const baseReply = brainAnswer.foundNodes.length ? brainAnswer.answer : fallbackReply;
    const reply = humanizeBrainReply({ message: lightweightBody.message, baseReply, foundNodes: brainAnswer.foundNodes.length, pendingCount: pending.length, webContext, webEnabled: Boolean(webSearch?.enabled), homeSummary, weatherContext });
    return NextResponse.json({ reply, action: brainAnswer.navigation ? "navigate" : webSearch ? "web_search_context" : weatherAlreadyAnswers ? "weather_context" : "summarize_context", navigation: brainAnswer.navigation ?? null, foundNodes: brainAnswer.foundNodes, webSearch, suggestedActions: brainAnswer.suggestedActions.map((action) => action.label).slice(0, 5), filters: lightweightBody.visibleFilters ?? {}, requiresConfirmation: false });
  }

  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return NextResponse.json({ error: status === 401 ? "Nao autorizado" : "Sem permissao" }, { status });
  if (isE2eJsonMode()) {
    const body = (await req.json().catch(() => ({}))) as { messages?: Array<{ role: "user" | "assistant"; content: string }>; agentMode?: AgentMode | null };
    if (!body.messages?.length) return NextResponse.json({ error: "Mensagens obrigatorias" }, { status: 400 });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(JSON.stringify({ type: "text-delta", text: `Brain E2E respondeu em modo ${body.agentMode ?? "qa"} com contexto mockado e seguro.` }) + "\n")); controller.close(); } });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Agent-Mode": body.agentMode ?? "qa", "Cache-Control": "no-cache" } });
  }

  try {
    const body = await req.json();
    const { messages, nodeId, agentMode, companySlug, route, screenLabel } = body as { messages: Array<{ role: "user" | "assistant"; content: string }>; nodeId?: string | null; agentMode?: AgentMode | null; companySlug?: string | null; route?: string | null; screenLabel?: string | null };
    if (!messages?.length) return NextResponse.json({ error: "Mensagens obrigatorias" }, { status: 400 });
    const lastUserMessage = [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
    const guardrailResult = runAllGuardrails(lastUserMessage);
    if (!guardrailResult.allowed) return NextResponse.json({ error: guardrailResult.blocked?.reason ?? "Mensagem bloqueada por guardrails de segurança.", guardrail: guardrailResult.blocked?.guardrail ?? "unknown" }, { status: 400 });
    const engine = new InternalBrainEngine();
    const events = engine.run({ messages, nodeId, agentMode, companySlug, route, screenLabel });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({ async start(controller) { let success = true; try { for await (const event of events) { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); if (event.type === "error") success = false; } } catch (err) { success = false; controller.enqueue(encoder.encode(JSON.stringify({ type: "error", error: String(err) }) + "\n")); } finally { controller.close(); void logAgentExecution({ agentMode: (agentMode ?? "qa") as AgentMode, userId: (admin as { id?: string }).id ?? "unknown", nodeId, messageCount: messages.length, success }); } } });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Agent-Mode": agentMode ?? "qa", "Cache-Control": "no-cache", "Transfer-Encoding": "chunked" } });
  } catch (error) {
    console.error("[brain/ask] POST error:", error);
    return NextResponse.json({ error: "Erro ao processar agente" }, { status: 500 });
  }
}
