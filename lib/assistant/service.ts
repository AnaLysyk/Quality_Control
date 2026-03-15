import "server-only";

import { appendAssistantAuditEntry } from "@/lib/assistantAuditLog";
import { resolveAssistantScreenContext } from "@/lib/assistant/screenContext";
import type {
  AssistantAction,
  AssistantConversationTurn,
  AssistantClientRequest,
  AssistantReplyPayload,
  AssistantScreenContext,
  AssistantToolAction,
  AssistantToolName,
} from "@/lib/assistant/types";
import { findLocalCompanyBySlug, findLocalUserByEmailOrId, getLocalUserById, listLocalCompanies, listLocalMemberships, listLocalUsers } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import { canAccessGlobalTicketWorkspace, canCommentTicket, canViewTicket } from "@/lib/rbac/tickets";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
import { createTicketComment, listTicketComments } from "@/lib/ticketCommentsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCommentAdded, notifyTicketCreated } from "@/lib/notificationService";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { createTicket, getTicketById, listAllTickets, listTicketsForUser, touchTicket, type TicketPriority, type TicketRecord, type TicketType } from "@/lib/ticketsStore";
import { assistantTestCaseSchema, ticketCommentSchema, ticketDraftSchema } from "@/lib/validation";

type AssistantExecutorResult = {
  tool: AssistantToolName;
  reply: string;
  actions?: AssistantAction[];
  success: boolean;
  summary: string | null;
};

type VisibleUsersContext = {
  users: Array<{
    id: string;
    name: string;
    email: string;
    login: string;
    role: string;
  }>;
  scope: "all" | "company" | "own" | "none";
};

type StructuredTicketDraft = {
  hasNamedFields: boolean;
  title: string;
  description: string;
  impact: string;
  expectedBehavior: string;
  currentBehavior: string;
  type: TicketType | null;
  priority: TicketPriority | null;
};

type AssistantTicketValidationResult = {
  ok: boolean;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  issues: string[];
};

type AssistantCommentValidationResult = {
  ok: boolean;
  body: string;
  issues: string[];
};

type AssistantTestCaseValidationResult = {
  ok: boolean;
  sourceTitle: string;
  objective: string;
  reproductionBase: string;
  expectedResult: string;
  issues: string[];
};

const MAX_RESULTS = 6;

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeSearch(value: string) {
  return stripAccents(value).toLowerCase().trim();
}

function normalizeText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function normalizePromptText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim()
    .slice(0, max);
}

function compactMultiline(value: string) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "sem data";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function displayRole(user: AuthUser) {
  return user.permissionRole ?? user.role ?? user.companyRole ?? "usuario";
}

function isSupportOperator(user: AuthUser) {
  const values = [user.permissionRole, user.role, user.companyRole]
    .map((value) => normalizeSearch(value ?? ""))
    .filter(Boolean);
  return values.some((value) => value === "support" || value === "it_dev" || value === "dev" || value === "developer");
}

function isAdminOperator(user: AuthUser) {
  const values = [user.permissionRole, user.role, user.companyRole]
    .map((value) => normalizeSearch(value ?? ""))
    .filter(Boolean);
  return values.some((value) => value === "admin" || value === "company_admin");
}

function isProtectedPlatformProfile(user: {
  globalRole?: string | null;
  role?: string | null;
}) {
  if (normalizeSearch(user.globalRole ?? "") === "global_admin") return true;
  const normalizedRole = normalizeSearch(user.role ?? "");
  return normalizedRole === "support" || normalizedRole === "it_dev" || normalizedRole === "dev" || normalizedRole === "developer";
}

function displayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || "usuario";
}

function reply(
  tool: AssistantToolName,
  context: AssistantScreenContext,
  result: Omit<AssistantExecutorResult, "tool">,
): AssistantReplyPayload {
  return {
    tool,
    reply: result.reply,
    actions: result.actions,
    context,
  };
}

function sanitizeRoute(route?: string | null) {
  if (typeof route !== "string") return "/";
  const trimmed = route.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function summarizePermissionMatrix(permissions: PermissionMatrix | null | undefined) {
  const entries = Object.entries(permissions ?? {}).filter(([, actions]) => Array.isArray(actions) && actions.length > 0);
  if (!entries.length) return "sem modulos liberados";
  return entries
    .slice(0, 6)
    .map(([moduleId, actions]) => `${moduleId}: ${actions.join(", ")}`)
    .join(" | ");
}

function extractTicketReference(text: string) {
  const codeMatch = text.match(/\bSP[-\s]?0*(\d{1,8})\b/i);
  if (codeMatch?.[1]) {
    const numeric = Number(codeMatch[1]);
    if (Number.isFinite(numeric)) {
      return {
        type: "code" as const,
        code: `SP-${String(numeric).padStart(6, "0")}`,
        numeric,
      };
    }
  }

  const uuidMatch = text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  if (uuidMatch?.[0]) {
    return {
      type: "id" as const,
      id: uuidMatch[0].toLowerCase(),
    };
  }

  const numericMatch = text.match(/\b(\d{2,8})\b/);
  if (numericMatch?.[1]) {
    const numeric = Number(numericMatch[1]);
    if (Number.isFinite(numeric)) {
      return {
        type: "numeric" as const,
        numeric,
        code: `SP-${String(numeric).padStart(6, "0")}`,
      };
    }
  }

  return null;
}

function scoreTicketMatch(ticket: TicketRecord, text: string) {
  const query = normalizeSearch(text);
  const code = normalizeSearch(ticket.code);
  const title = normalizeSearch(ticket.title);
  const description = normalizeSearch(ticket.description);
  const creator = normalizeSearch(ticket.createdByName ?? "");

  if (!query) return 0;
  if (code === query) return 100;
  if (code.endsWith(query)) return 90;
  if (title.startsWith(query)) return 70;
  if (title.includes(query)) return 55;
  if (description.includes(query)) return 40;
  if (creator.includes(query)) return 25;
  return 0;
}

function formatTicketCard(ticket: Awaited<ReturnType<typeof attachAssigneeToTicket>>) {
  if (!ticket) return "";
  return [
    `${ticket.code} — ${ticket.title}`,
    `status: ${ticket.status} | prioridade: ${ticket.priority} | tipo: ${ticket.type}`,
    `criador: ${ticket.createdByName ?? "nao identificado"} | responsavel: ${ticket.assignedToName ?? "nao definido"}`,
    `atualizado em: ${formatDateTime(ticket.updatedAt)}`,
  ].join("\n");
}

function inferTicketType(message: string, context: AssistantScreenContext): TicketType {
  const normalized = normalizeSearch(message);
  if (normalized.includes("bug") || normalized.includes("erro") || normalized.includes("falha")) return "bug";
  if (normalized.includes("melhoria") || normalized.includes("sugest")) return "melhoria";
  if (context.module === "test_plans") return "tarefa";
  return "tarefa";
}

function inferTicketPriority(message: string): TicketPriority {
  const normalized = normalizeSearch(message);
  if (
    normalized.includes("urgente") ||
    normalized.includes("critico") ||
    normalized.includes("crítico") ||
    normalized.includes("bloqueia") ||
    normalized.includes("nao abre") ||
    normalized.includes("não abre")
  ) {
    return "high";
  }
  if (normalized.includes("baixa") || normalized.includes("simples")) return "low";
  return "medium";
}

function buildTicketTitle(message: string, context: AssistantScreenContext) {
  const cleaned = message
    .replace(/\b(criar|cria|abrir|abre|gerar|gera|transformar|transforma)\b/gi, "")
    .replace(/\b(ticket|chamado|suporte)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const firstSentence = cleaned.split(/[.!?\n]/)[0]?.trim();
  if (firstSentence) {
    return firstSentence.slice(0, 110);
  }
  return `Chamado - ${context.screenLabel}`;
}

function buildTicketDescription(message: string, context: AssistantScreenContext) {
  return compactMultiline(
    [
      "Relato estruturado pelo agente da plataforma.",
      "",
      `Tela atual: ${context.screenLabel}`,
      `Rota: ${context.route}`,
      "",
      "Descricao:",
      message.trim(),
    ].join("\n"),
  ).slice(0, 1900);
}

function isTicketTemplateRequest(message: string) {
  const normalized = normalizeSearch(message);
  return (
    normalized.includes("modelo de chamado") ||
    normalized.includes("modelo de ticket") ||
    normalized.includes("titulo, descricao, impacto e comportamento esperado") ||
    normalized.includes("titulo descricao impacto e comportamento esperado") ||
    /quero criar .*chamado.*titulo.*descricao.*impacto/.test(normalized) ||
    /quero criar .*ticket.*titulo.*descricao.*impacto/.test(normalized)
  );
}

function parseStructuredTicketDraft(message: string): StructuredTicketDraft | null {
  const lines = message.split(/\r?\n/);
  const buckets: Record<string, string[]> = {
    title: [],
    description: [],
    impact: [],
    expectedBehavior: [],
    currentBehavior: [],
    type: [],
    priority: [],
  };

  let currentField: keyof typeof buckets | null = null;
  let hasNamedFields = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentField && currentField !== "title" && currentField !== "type" && currentField !== "priority") {
        buckets[currentField].push("");
      }
      continue;
    }

    const normalized = normalizeSearch(line);
    const matchers: Array<[keyof typeof buckets, RegExp]> = [
      ["title", /^(titulo|título)\s*:\s*(.*)$/i],
      ["description", /^(descricao|descrição)\s*:\s*(.*)$/i],
      ["impact", /^impacto\s*:\s*(.*)$/i],
      ["expectedBehavior", /^(comportamento esperado|resultado esperado)\s*:\s*(.*)$/i],
      ["currentBehavior", /^(comportamento atual|resultado atual)\s*:\s*(.*)$/i],
      ["type", /^tipo\s*:\s*(.*)$/i],
      ["priority", /^(prioridade|severidade)\s*:\s*(.*)$/i],
    ];

    const matched = matchers.find(([, pattern]) => pattern.test(line));
    if (matched) {
      const [field, pattern] = matched;
      const value = line.replace(pattern, "$2").trim();
      hasNamedFields = true;
      currentField = field;
      if (value) buckets[field].push(value);
      continue;
    }

    if (
      normalized.startsWith("titulo") ||
      normalized.startsWith("descricao") ||
      normalized.startsWith("impacto") ||
      normalized.startsWith("comportamento esperado") ||
      normalized.startsWith("comportamento atual")
    ) {
      continue;
    }

    if (currentField) {
      buckets[currentField].push(line);
    }
  }

  const title = compactMultiline(buckets.title.join("\n"));
  const description = compactMultiline(buckets.description.join("\n"));
  const impact = compactMultiline(buckets.impact.join("\n"));
  const expectedBehavior = compactMultiline(buckets.expectedBehavior.join("\n"));
  const currentBehavior = compactMultiline(buckets.currentBehavior.join("\n"));
  const typeRaw = normalizeSearch(compactMultiline(buckets.type.join(" ")));
  const priorityRaw = normalizeSearch(compactMultiline(buckets.priority.join(" ")));

  const parsedType: TicketType | null = typeRaw.includes("bug")
    ? "bug"
    : typeRaw.includes("melhoria")
      ? "melhoria"
      : typeRaw.includes("tarefa")
        ? "tarefa"
        : null;

  const parsedPriority: TicketPriority | null = priorityRaw.includes("urgente") || priorityRaw.includes("alta") || priorityRaw.includes("high")
    ? "high"
    : priorityRaw.includes("baixa") || priorityRaw.includes("low")
      ? "low"
      : priorityRaw.includes("media") || priorityRaw.includes("média") || priorityRaw.includes("medium")
        ? "medium"
        : null;

  if (!hasNamedFields && !title && !description && !impact && !expectedBehavior && !currentBehavior && !parsedType && !parsedPriority) {
    return null;
  }

  return {
    hasNamedFields,
    title,
    description,
    impact,
    expectedBehavior,
    currentBehavior,
    type: parsedType,
    priority: parsedPriority,
  };
}

function buildStructuredTicketDescription(draft: StructuredTicketDraft, context: AssistantScreenContext) {
  return compactMultiline(
    [
      "Relato estruturado pelo agente da plataforma.",
      "",
      `Tela atual: ${context.screenLabel}`,
      `Rota: ${context.route}`,
      "",
      "Descricao:",
      draft.description || "Nao informado.",
      draft.impact ? `\nImpacto:\n${draft.impact}` : "",
      draft.currentBehavior ? `\nComportamento atual:\n${draft.currentBehavior}` : "",
      draft.expectedBehavior ? `\nComportamento esperado:\n${draft.expectedBehavior}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  ).slice(0, 1900);
}

function buildStructuredTicketTemplate() {
  return compactMultiline([
    "Use este modelo para eu estruturar melhor o chamado:",
    "",
    "Titulo:",
    "Descricao:",
    "Impacto:",
    "Comportamento esperado:",
    "Comportamento atual:",
    "Tipo: bug | tarefa | melhoria",
    "Prioridade: baixa | media | alta",
  ].join("\n"));
}

function extractNarrativePayload(message: string) {
  const directPayloadPatterns = [
    /(?:converter|transformar)\s+(?:esta|essa|a)?\s*nota\s+(.+?)\s+em\s+(?:chamado|ticket)\b/i,
    /(?:criar|montar|abrir)\s+(?:um\s+)?(?:chamado|ticket)\s+com\s+base\s+(?:neste|nesse|nesta|nessa)\s+(?:relato|texto|conteudo|conteúdo)\s*:\s*(.+)$/i,
    /(?:converter|transformar)\s+(?:este|esse|esta|essa)\s+(?:texto|relato|conteudo|conteúdo)\s+em\s+(?:chamado|ticket)\s*:\s*(.+)$/i,
  ];

  for (const pattern of directPayloadPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return compactMultiline(match[1]).trim();
    }
  }

  const colonMatch = message.match(/(?:nota|relato|texto|conteudo|conteúdo)\s*:\s*(.+)$/i);
  if (colonMatch?.[1]) {
    return compactMultiline(colonMatch[1]).trim();
  }

  return "";
}

function buildTestCaseTemplate() {
  return compactMultiline([
    "Use este modelo para eu validar o caso de teste antes de montar:",
    "",
    "Titulo:",
    "Objetivo:",
    "Pre-condicoes:",
    "Passos:",
    "Resultado esperado:",
    "Severidade/Prioridade:",
  ].join("\n"));
}

function normalizeConversationHistory(history: AssistantClientRequest["history"]) {
  if (!Array.isArray(history)) return [] as AssistantConversationTurn[];
  return history
    .slice(-12)
    .map((item) => ({
      from: (item?.from === "assistant" ? "assistant" : "user") as "assistant" | "user",
      text: normalizeText(item?.text, 4000),
      tool: item?.tool ?? null,
      ts: typeof item?.ts === "number" ? item.ts : undefined,
      actionLabels: Array.isArray(item?.actionLabels)
        ? item.actionLabels.map((label) => normalizeText(label, 160)).filter(Boolean)
        : [],
    }))
    .filter((item) => item.text);
}

function getLastAssistantTurn(history: AssistantConversationTurn[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.from === "assistant") return history[index];
  }
  return null;
}

function getLastUserTurn(history: AssistantConversationTurn[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.from === "user") return history[index];
  }
  return null;
}

function getLastMeaningfulAssistantTurn(history: AssistantConversationTurn[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (turn?.from !== "assistant") continue;
    if (!turn.text) continue;
    return turn;
  }
  return null;
}

function isAwaitingTicketPayload(history: AssistantConversationTurn[]) {
  const lastAssistantTurn = getLastMeaningfulAssistantTurn(history);
  if (!lastAssistantTurn || lastAssistantTurn.tool !== "create_ticket") return false;
  const text = normalizeSearch(lastAssistantTurn.text);
  return (
    text.includes("preciso do conteudo real") ||
    text.includes("preciso validar os dados do modulo de suporte") ||
    text.includes("use este modelo para eu estruturar melhor o chamado") ||
    text.includes("pendencias encontradas") ||
    text.includes("complete o modelo") ||
    text.includes("faltam campos")
  );
}

function isAwaitingTestCasePayload(history: AssistantConversationTurn[]) {
  const lastAssistantTurn = getLastMeaningfulAssistantTurn(history);
  if (!lastAssistantTurn || lastAssistantTurn.tool !== "draft_test_case") return false;
  const text = normalizeSearch(lastAssistantTurn.text);
  return (
    text.includes("antes de montar o caso de teste") ||
    text.includes("use este modelo para eu validar o caso de teste") ||
    text.includes("preciso passar pelas validacoes do modulo de testes")
  );
}

function looksLikeFreeformContent(message: string) {
  const trimmed = normalizeText(message, 3000);
  if (!trimmed) return false;
  if (trimmed.length < 6) return false;
  const normalized = normalizeSearch(trimmed);
  if (
    /^(resumir|explicar|mostrar|buscar|procurar|gerar|montar|criar|transformar|converter|comentar|publicar|listar)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  return true;
}

function isLowSignalMessage(message: string) {
  const normalized = normalizeSearch(message);
  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (Boolean(extractTicketReference(message))) return false;
  if (Boolean(extractNarrativePayload(message))) return false;
  if (Boolean(parseStructuredTicketDraft(message)?.hasNamedFields)) return false;

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasKnownIntent = /(ticket|chamado|bug|erro|empresa|usuario|perfil|permiss|nota|teste|caso|coment|resum|buscar|mostrar|explicar|criar|gerar|transformar|converter|modelo)/.test(
    normalized,
  );

  if (hasKnownIntent) return false;
  if (tokenCount === 1 && normalized.length <= 14) return true;
  if (tokenCount <= 2 && normalized.length <= 18) return true;
  return false;
}

function shouldShortCircuitRepeatedPrompt(
  history: AssistantConversationTurn[],
  tool: AssistantToolName,
  message: string,
) {
  const lastUserTurn = getLastUserTurn(history);
  const lastAssistantTurn = getLastAssistantTurn(history);
  if (!lastUserTurn || !lastAssistantTurn) return false;
  if (lastAssistantTurn.tool !== tool) return false;

   if (tool === "create_ticket") {
    if (isAwaitingTicketPayload(history)) return false;
    if (isTicketTemplateRequest(message)) return false;
    if (Boolean(parseStructuredTicketDraft(message))) return false;
    if (Boolean(extractNarrativePayload(message))) return false;
  }
  if (tool === "draft_test_case" && isAwaitingTestCasePayload(history)) {
    return false;
  }

  const current = normalizeSearch(message);
  const previous = normalizeSearch(lastUserTurn.text);
  if (!current || current !== previous) return false;

  return true;
}

function maybeCollapseRepeatedActions(actions: AssistantAction[] | undefined, history: AssistantConversationTurn[]) {
  if (!actions?.length) return actions;
  const lastAssistantTurn = getLastAssistantTurn(history);
  if (!lastAssistantTurn?.actionLabels?.length) return actions;

  const nextLabels = actions.map((action) => normalizeSearch(action.label));
  const previousLabels = lastAssistantTurn.actionLabels.map((label) => normalizeSearch(label));
  if (nextLabels.length !== previousLabels.length) return actions;
  if (nextLabels.every((label, index) => label === previousLabels[index])) {
    return undefined;
  }
  return actions;
}

function normalizeCommentForComparison(text: string) {
  return normalizeSearch(text).replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function buildRecentDuplicateReply(tool: AssistantToolName, context: AssistantScreenContext): AssistantExecutorResult {
  const messages: Record<AssistantToolName, string> = {
    get_screen_context: "Acabei de mostrar esse contexto nesta conversa. Se quiser, posso aprofundar em permissao, chamados ou empresa atual.",
    list_available_actions: "Ja listei as acoes disponiveis agora ha pouco. Se quiser, posso executar uma delas com base no seu contexto atual.",
    search_internal_records: "Acabei de rodar essa busca. Se quiser, refine por ID, status, prioridade, usuario ou empresa.",
    summarize_entity: "Ja fiz esse resumo agora ha pouco. Se quiser, posso detalhar um ponto especifico ou resumir outra entidade.",
    draft_test_case: "Ja gerei um caso de teste com esse contexto recente. Se quiser, posso refinar para bug, melhoria ou fluxo especifico.",
    explain_permission: "Ja expliquei esse escopo nesta conversa. Se quiser, posso comparar com outra tela, perfil ou modulo.",
    create_ticket: "Ja analisei esse pedido de criacao recentemente. Se quiser, me envie dados novos ou um modelo preenchido.",
    create_comment: "Ja tratei esse comentario recentemente. Se quiser, posso montar uma atualizacao diferente.",
    suggest_next_step: "Ja sugeri o proximo passo nesta conversa. Se quiser, eu sigo direto para a proxima acao util.",
  };

  return {
    tool,
    success: true,
    summary: "resposta repetida evitada",
    actions: buildPromptActions(context),
    reply: messages[tool],
  };
}

function buildClarifyReply(context: AssistantScreenContext): AssistantExecutorResult {
  return {
    tool: "suggest_next_step",
    success: true,
    summary: "pedido pouco claro",
    actions: buildPromptActions(context),
    reply: compactMultiline([
      "Nao consegui interpretar esse texto como uma acao valida nesta tela.",
      "",
      "Se quiser, posso ajudar de forma objetiva com algo como:",
      "- resumir esta tela",
      "- explicar meu escopo de acesso",
      "- transformar um relato real em chamado",
      "- buscar um chamado por ID",
    ].join("\n")),
  };
}

function formatValidationIssues(issues: string[]) {
  return issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n");
}

function normalizeTicketTypeInput(value: string): TicketType | null {
  if (!value) return null;
  if (value === "bug" || value === "tarefa" || value === "melhoria") return value;
  return null;
}

function normalizeTicketPriorityInput(value: string): TicketPriority | null {
  if (!value) return null;
  if (value === "high" || value === "alta" || value === "urgente") return "high";
  if (value === "low" || value === "baixa") return "low";
  if (value === "medium" || value === "media" || value === "media") return "medium";
  return null;
}

function looksLikeInstructionOnly(value: string) {
  const normalized = normalizeSearch(value);
  if (!normalized) return true;

  const exactMatches = new Set([
    "mostrar acoes disponiveis",
    "explicar meu escopo de acesso",
    "resumir esta tela",
    "resumir meu perfil atual",
    "buscar chamado por id",
    "buscar ticket por id",
    "criar chamado",
    "criar ticket",
    "abrir chamado",
    "abrir ticket",
    "transformar texto ou nota em chamado",
    "transformar texto em chamado",
    "transformar nota em chamado",
    "transformar relato em chamado",
    "converter nota em chamado",
    "gerar caso de teste",
    "criar caso de teste",
    "montar caso de teste",
    "usar modelo de chamado",
    "usar modelo de caso de teste",
    "publicar comentario",
    "montar comentario tecnico",
  ]);

  if (exactMatches.has(normalized)) return true;
  if (/^(criar|abrir|gerar|montar|transformar|converter)\s+(um\s+)?(chamado|ticket|caso de teste|nota)\b/.test(normalized)) {
    return true;
  }
  return false;
}

function extractTicketNarrativeSource(message: string) {
  return message
    .replace(/\b(criar|cria|abrir|abre|gerar|gera|transformar|transforma|converter|converte|montar|monta)\b/gi, "")
    .replace(/\b(ticket|chamado|suporte|nota)\b/gi, "")
    .replace(/\b(com base|a partir|desta tela|dessa tela|deste texto|desse texto)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateAssistantTicketDraft(input: {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  priority?: unknown;
}): AssistantTicketValidationResult {
  const title = normalizeText(input.title, 120);
  const description = normalizeText(input.description, 2000);
  const typeValue = normalizeSearch(normalizeText(input.type, 20));
  const priorityValue = normalizeSearch(normalizeText(input.priority, 20));
  const issues: string[] = [];

  const parsed = ticketDraftSchema.safeParse({
    title,
    description,
    type: normalizeTicketTypeInput(typeValue) ?? undefined,
    priority: normalizeTicketPriorityInput(priorityValue) ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.title?.length) {
      issues.push("Titulo do chamado obrigatorio, com pelo menos 3 caracteres.");
    }
    if (fieldErrors.description?.length) {
      issues.push("Descricao do chamado obrigatoria, com pelo menos 8 caracteres.");
    }
  }

  if (typeValue && !normalizeTicketTypeInput(typeValue)) {
    issues.push("Tipo do chamado invalido. Use bug, tarefa ou melhoria.");
  }
  if (priorityValue && !normalizeTicketPriorityInput(priorityValue)) {
    issues.push("Prioridade invalida. Use baixa, media ou alta.");
  }
  if (looksLikeInstructionOnly(title)) {
    issues.push("O titulo ainda esta como instrucao. Informe o titulo real do chamado.");
  }
  if (looksLikeInstructionOnly(description)) {
    issues.push("A descricao ainda nao traz o relato real. Cole o problema, a nota ou o comportamento observado.");
  }

  return {
    ok: issues.length === 0,
    title,
    description,
    type: normalizeTicketTypeInput(typeValue) ?? "tarefa",
    priority: normalizeTicketPriorityInput(priorityValue) ?? "medium",
    issues,
  };
}

function validateAssistantCommentBody(bodyInput: unknown): AssistantCommentValidationResult {
  const body = normalizeText(bodyInput, 2000);
  const issues: string[] = [];
  const parsed = ticketCommentSchema.safeParse({ body });

  if (!parsed.success) {
    issues.push("Comentario obrigatorio, com pelo menos 3 caracteres.");
  }
  if (looksLikeInstructionOnly(body)) {
    issues.push("O texto do comentario ainda esta como instrucao. Informe o comentario real antes de publicar.");
  }

  return {
    ok: issues.length === 0,
    body,
    issues,
  };
}

function validateAssistantTestCaseDraft(input: {
  sourceTitle: string;
  objective: string;
  reproductionBase: string;
  expectedResult: string;
}): AssistantTestCaseValidationResult {
  const sourceTitle = normalizeText(input.sourceTitle, 120);
  const objective = normalizeText(input.objective, 600);
  const reproductionBase = normalizeText(input.reproductionBase, 500);
  const expectedResult = normalizeText(input.expectedResult, 600);
  const issues: string[] = [];
  const parsed = assistantTestCaseSchema.safeParse({
    sourceTitle,
    objective,
    reproductionBase,
    expectedResult,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.sourceTitle?.length) {
      issues.push("Titulo/base do caso de teste obrigatorio.");
    }
    if (fieldErrors.objective?.length) {
      issues.push("Objetivo do caso de teste obrigatorio e precisa ser mais especifico.");
    }
    if (fieldErrors.reproductionBase?.length) {
      issues.push("Preciso do fluxo, bug ou relato base para montar os passos do teste.");
    }
    if (fieldErrors.expectedResult?.length) {
      issues.push("Resultado esperado obrigatorio para validar o comportamento.");
    }
  }

  if (looksLikeInstructionOnly(sourceTitle) || looksLikeInstructionOnly(reproductionBase)) {
    issues.push("Ainda nao tenho contexto funcional suficiente. Envie o bug, relato ou ticket base antes de gerar o caso de teste.");
  }

  return {
    ok: issues.length === 0,
    sourceTitle,
    objective,
    reproductionBase,
    expectedResult,
    issues,
  };
}

function extractCommentBody(message: string) {
  return message
    .replace(/\b(comentar|comente|comentario|comentário|responder|resposta|adicione|adiciona)\b/gi, "")
    .replace(/\b(montar|monta|gerar|gera|criar|cria)\b/gi, "")
    .replace(/\b(chamado|ticket|suporte)\b/gi, "")
    .replace(/\bSP[-\s]?\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchText(message: string) {
  return message
    .replace(/\b(buscar|busca|procura|procurar|localiza|localizar|encontra|encontrar|listar|lista|mostrar|mostra)\b/gi, "")
    .replace(/\b(ticket|tickets|chamado|chamados|suporte|suportes)\b/gi, "")
    .replace(/\b(sem|com)\s+(responsavel|responsável)\b/gi, "")
    .replace(/\b(backlog|andamento|revisao|revisão|concluido|concluído)\b/gi, "")
    .replace(/\b(alta|media|média|baixa|urgente)\b/gi, "")
    .replace(/\b(status|prioridade|empresa|usuario|usuário|perfil)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGreetingPrompt(message: string) {
  const normalized = normalizeSearch(message);
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí)\b/.test(normalized);
}

function isGenericTicketPrompt(message: string) {
  const normalized = normalizeSearch(message);
  return (
    normalized === "transformar texto ou nota em chamado" ||
    normalized === "transformar texto em chamado" ||
    normalized === "transformar nota em chamado" ||
    normalized === "criar ticket a partir desta tela" ||
    normalized === "transformar relato em chamado"
  );
}

function isGenericCommentRequest(message: string, body: string) {
  const normalized = normalizeSearch(message);
  const genericBody = normalizeSearch(body);
  return (
    normalized.includes("montar comentario tecnico") ||
    normalized.includes("montar comentário técnico") ||
    normalized.includes("gerar comentario tecnico") ||
    normalized.includes("gerar comentário técnico") ||
    genericBody.length < 18
  );
}

function buildDraftCommentFromTicket(
  ticket: Awaited<ReturnType<typeof findVisibleTicket>>,
  recentCommentCount = 0,
) {
  if (!ticket) return "";
  const itemTypeLabel =
    ticket.type === "bug" ? "bug reportado" : ticket.type === "melhoria" ? "solicitacao de melhoria" : "chamado";
  const statusLine =
    ticket.status === "backlog"
      ? "O item segue em backlog aguardando triagem operacional."
      : ticket.status === "doing"
        ? "O item esta em atendimento ativo pelo suporte."
        : ticket.status === "review"
          ? "O item esta em revisao tecnica."
          : "O item consta como concluido no fluxo.";
  const continuationLine =
    recentCommentCount > 0
      ? "Atualizando o historico tecnico com base no contexto atual e nos comentarios ja registrados."
      : "Registrando a primeira triagem tecnica deste chamado.";

  return compactMultiline([
    `${continuationLine}`,
    `Analise do ${itemTypeLabel} ${ticket.code}: titulo "${ticket.title}".`,
    `Contexto atual: status ${ticket.status}, prioridade ${ticket.priority} e responsavel ${ticket.assignedToName ?? "nao definido"}.`,
    statusLine,
    "Proximo passo sugerido: reproduzir o fluxo informado, validar impacto real e anexar evidencia tecnica ou conclusao objetiva.",
  ].join("\n"));
}

function buildPromptActions(context: AssistantScreenContext): AssistantAction[] {
  return context.suggestedPrompts.slice(0, 4).map((prompt) => ({
    kind: "prompt",
    label: prompt,
    prompt,
  }));
}

async function getVisibleTickets(user: AuthUser) {
  const items = canAccessGlobalTicketWorkspace(user) ? await listAllTickets() : await listTicketsForUser(user.id);
  return attachAssigneeInfo(items);
}

async function findVisibleTicket(user: AuthUser, input: string) {
  const visible = await getVisibleTickets(user);
  const reference = extractTicketReference(input);

  if (reference?.type === "id") {
    const exact = visible.find((ticket) => ticket.id.toLowerCase() === reference.id);
    if (exact) return exact;
  }

  if (reference?.code) {
    const exact = visible.find((ticket) => ticket.code.toLowerCase() === reference.code.toLowerCase());
    if (exact) return exact;
  }

  const query = normalizeText(input);
  return visible
    .map((ticket) => ({ ticket, score: scoreTicketMatch(ticket, query) }))
    .sort((a, b) => b.score - a.score)
    .find((entry) => entry.score > 0)?.ticket ?? null;
}

async function getVisibleUsers(user: AuthUser): Promise<VisibleUsersContext> {
  const canViewUsers =
    hasPermissionAccess(user.permissions, "users", "view") ||
    hasPermissionAccess(user.permissions, "users", "view_company") ||
    hasPermissionAccess(user.permissions, "users", "view_all") ||
    isSupportOperator(user);

  if (!canViewUsers) {
    const current = await getLocalUserById(user.id);
    return {
      users: current
        ? [
            {
              id: current.id,
              name: displayName(current),
              email: current.email,
              login: current.user ?? current.email,
              role: displayRole(user),
            },
          ]
        : [],
      scope: "own",
    };
  }

  const scope = hasPermissionAccess(user.permissions, "users", "view_all") || isSupportOperator(user)
    ? "all"
    : hasPermissionAccess(user.permissions, "users", "view_company")
      ? "company"
      : "own";

  const [users, companies, memberships] = await Promise.all([
    listLocalUsers(),
    listLocalCompanies(),
    listLocalMemberships(),
  ]);

  if (scope === "all") {
    const visibleUsers = users
      .filter((item) => !(isAdminOperator(user) && !isSupportOperator(user) && isProtectedPlatformProfile(item)))
      .map((item) => ({
        id: item.id,
        name: displayName(item),
        email: item.email,
        login: item.user ?? item.email,
        role: item.role ?? "user",
      }));

    return {
      scope,
      users: visibleUsers,
    };
  }

  if (scope === "company") {
    const allowedCompanyIds = new Set<string>();
    if (user.companyId) allowedCompanyIds.add(user.companyId);

    const allowedSlugs = new Set((user.companySlugs ?? []).map((item) => normalizeSearch(item)));
    for (const company of companies) {
      if (allowedSlugs.has(normalizeSearch(company.slug))) {
        allowedCompanyIds.add(company.id);
      }
    }

    const allowedUserIds = new Set(
      memberships
        .filter((membership) => allowedCompanyIds.has(membership.companyId))
        .map((membership) => membership.userId),
    );
    allowedUserIds.add(user.id);

    return {
      scope,
      users: users
        .filter((item) => allowedUserIds.has(item.id))
        .map((item) => ({
          id: item.id,
          name: displayName(item),
          email: item.email,
          login: item.user ?? item.email,
          role: item.role ?? "user",
        })),
    };
  }

  const current = users.find((item) => item.id === user.id);
  return {
    scope,
    users: current
      ? [
          {
            id: current.id,
            name: displayName(current),
            email: current.email,
            login: current.user ?? current.email,
            role: current.role ?? "user",
          },
        ]
      : [],
  };
}

async function getVisibleCompanies(user: AuthUser) {
  if (
    !hasPermissionAccess(user.permissions, "applications", "view") &&
    !isSupportOperator(user) &&
    !canAccessGlobalTicketWorkspace(user)
  ) {
    return [];
  }
  const companies = await listLocalCompanies();
  if (canAccessGlobalTicketWorkspace(user) || user.isGlobalAdmin || isSupportOperator(user)) return companies;

  const allowedIds = new Set<string>();
  if (user.companyId) allowedIds.add(user.companyId);
  const allowedSlugs = new Set((user.companySlugs ?? []).map((item) => normalizeSearch(item)));
  return companies.filter((company) => allowedIds.has(company.id) || allowedSlugs.has(normalizeSearch(company.slug)));
}

function getStatusFilters(message: string) {
  const normalized = normalizeSearch(message);
  if (normalized.includes("concluido") || normalized.includes("concluído")) return new Set(["done"]);
  if (normalized.includes("revisao") || normalized.includes("revisão")) return new Set(["review"]);
  if (normalized.includes("andamento")) return new Set(["doing"]);
  if (normalized.includes("backlog")) return new Set(["backlog"]);
  return null;
}

function getPriorityFilters(message: string) {
  const normalized = normalizeSearch(message);
  if (normalized.includes("urgente") || normalized.includes("alta")) return new Set(["high"]);
  if (normalized.includes("media") || normalized.includes("média")) return new Set(["medium"]);
  if (normalized.includes("baixa")) return new Set(["low"]);
  return null;
}

async function toolGetScreenContext(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const currentUser = await getLocalUserById(user.id);
  return {
    tool: "get_screen_context",
    success: true,
    summary: context.screenLabel,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `${context.screenLabel}`,
      context.screenSummary,
      "",
      `Rota atual: ${context.route}`,
      `Modulo: ${context.module}`,
      `Usuario atual: ${displayName(currentUser)} | ${currentUser?.user ?? currentUser?.email ?? user.email}`,
      `Perfil atual: ${displayRole(user)}`,
      `Escopo de empresa: ${context.companySlug ?? user.companySlug ?? "global"}`,
      `Permissoes relevantes: ${summarizePermissionMatrix(user.permissions)}`,
    ].join("\n")),
  };
}

async function toolListAvailableActions(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const actions: string[] = [];

  actions.push("Ler o contexto da tela atual");
  actions.push("Buscar registros internos visiveis para o seu perfil");

  if (
    hasPermissionAccess(user.permissions, "tickets", "create") ||
    hasPermissionAccess(user.permissions, "support", "create")
  ) {
    actions.push("Montar e criar chamado a partir de texto solto");
  }
  if (hasPermissionAccess(user.permissions, "tickets", "comment") || hasPermissionAccess(user.permissions, "support", "comment")) {
    actions.push("Montar comentario tecnico em chamado visivel");
  }
  if (context.module === "test_plans") {
    actions.push("Gerar caso de teste estruturado com base no contexto");
  }
  if (context.module === "permissions" || hasPermissionAccess(user.permissions, "permissions", "view")) {
    actions.push("Explicar por que um perfil ve ou nao ve um modulo");
  }
  actions.push("Resumir tickets, usuarios, empresas e conversas acessiveis");
  actions.push("Sugerir o proximo passo mais util nesta tela");

  return {
    tool: "list_available_actions",
    success: true,
    summary: `${actions.length} acoes disponiveis`,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      "Posso agir dentro do seu perfil atual, sem ultrapassar RBAC, usando a sessao ativa, o contexto da tela e os dados do seu proprio perfil.",
      "",
      ...actions.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n")),
  };
}

async function toolSearchInternalRecords(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const visibleTickets = await getVisibleTickets(user);
  const normalized = normalizeSearch(message);
  const statusFilters = getStatusFilters(message);
  const priorityFilters = getPriorityFilters(message);
  const wantsOnlyUnassigned = normalized.includes("sem responsavel") || normalized.includes("sem responsável");
  const wantsOnlyAssigned = normalized.includes("com responsavel") || normalized.includes("com responsável");
  const reference = extractTicketReference(message);

  let tickets = [...visibleTickets];
  if (statusFilters) tickets = tickets.filter((ticket) => statusFilters.has(ticket.status));
  if (priorityFilters) tickets = tickets.filter((ticket) => priorityFilters.has(ticket.priority));
  if (wantsOnlyUnassigned) tickets = tickets.filter((ticket) => !ticket.assignedToUserId);
  if (wantsOnlyAssigned) tickets = tickets.filter((ticket) => Boolean(ticket.assignedToUserId));

  const query = extractSearchText(message);
  const hasExplicitFilters = Boolean(statusFilters || priorityFilters || wantsOnlyUnassigned || wantsOnlyAssigned);

  if (reference?.code) {
    const exact = tickets.find((ticket) => ticket.code.toLowerCase() === reference.code.toLowerCase());
    if (exact) tickets = [exact];
  } else if (query) {
    tickets = tickets
      .map((ticket) => ({ ticket, score: scoreTicketMatch(ticket, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.ticket);
  }

  if (!reference && !query && !hasExplicitFilters) {
    const latest = tickets.slice(0, MAX_RESULTS);
    return {
      tool: "search_internal_records",
      success: true,
      summary: latest.length ? `${latest.length} chamados recentes visiveis` : "nenhum chamado visivel",
      actions: [
        { kind: "prompt", label: "Buscar chamado por ID", prompt: "Buscar o chamado SP-000001" },
        { kind: "prompt", label: "Alta sem responsavel", prompt: "Buscar tickets com prioridade alta sem responsavel" },
        { kind: "prompt", label: "Transformar nota em chamado", prompt: "Transformar este texto em chamado estruturado" },
      ],
      reply: latest.length
        ? [
            "Posso buscar por ID, status, prioridade, empresa ou usuario. Tambem consigo usar seu contexto atual para transformar texto ou nota em chamado. Enquanto isso, aqui estao alguns chamados visiveis no seu escopo:",
            "",
            ...latest.map((ticket) => `- ${ticket.code} | ${ticket.title} | ${ticket.status} | prioridade ${ticket.priority}`),
          ].join("\n")
        : "Nao encontrei chamados visiveis neste escopo agora. Se quiser, me informe um ID como `SP-000027` ou um filtro mais especifico.",
    };
  }

  const [visibleUsers, visibleCompanies] = await Promise.all([getVisibleUsers(user), getVisibleCompanies(user)]);

  const users =
    /usuario|usuário|perfil|responsavel|responsável|login|email/.test(normalized)
      ? visibleUsers.users
          .filter((item) => {
            if (!query) return true;
            const haystack = `${item.name} ${item.email} ${item.login}`.toLowerCase();
            return haystack.includes(normalized);
          })
          .slice(0, MAX_RESULTS)
      : [];

  const companies =
    /empresa|cliente|tenant/.test(normalized)
      ? visibleCompanies
          .filter((item) => {
            if (!query) return true;
            const haystack = `${item.name} ${item.slug}`.toLowerCase();
            return haystack.includes(normalized);
          })
          .slice(0, MAX_RESULTS)
      : [];

  const sections: string[] = [];
  if (tickets.length) {
    sections.push(
      "Chamados encontrados:",
      ...tickets.slice(0, MAX_RESULTS).map((ticket) => `- ${ticket.code} | ${ticket.title} | ${ticket.status} | prioridade ${ticket.priority}`),
    );
  }
  if (users.length) {
    sections.push(
      "",
      "Usuarios encontrados:",
      ...users.map((item) => `- ${item.name} | ${item.login} | ${item.email}`),
    );
  }
  if (companies.length) {
    sections.push(
      "",
      "Empresas encontradas:",
      ...companies.map((item) => `- ${item.name} | slug ${item.slug}`),
    );
  }

  if (!sections.length) {
    return {
      tool: "search_internal_records",
      success: true,
      summary: "nenhum registro encontrado",
      actions: [
        { kind: "prompt", label: "Explicar meu escopo", prompt: "Explicar meu escopo de acesso" },
        { kind: "prompt", label: "Resumir esta tela", prompt: "Resumir esta tela" },
        { kind: "prompt", label: "Transformar texto em chamado", prompt: "Transformar texto ou nota em chamado" },
      ],
      reply: "Nao encontrei registros visiveis para esse criterio dentro do seu escopo atual. Posso tentar por ID do chamado, nome, status, prioridade ou empresa.",
    };
  }

  return {
    tool: "search_internal_records",
    success: true,
    summary: `tickets ${tickets.length} | usuarios ${users.length} | empresas ${companies.length}`,
    actions: tickets[0]
      ? [
          { kind: "prompt", label: "Resumir primeiro chamado", prompt: `Resumir o chamado ${tickets[0].code}` },
          { kind: "prompt", label: "Sugerir proximo passo", prompt: `Qual o proximo passo para o chamado ${tickets[0].code}?` },
        ]
      : buildPromptActions(context),
    reply: sections.join("\n"),
  };
}

async function toolSummarizeEntity(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const normalized = normalizeSearch(message);
  if (normalized.includes("perfil") || normalized.includes("meus dados") || normalized.includes("meu usuario") || normalized.includes("meu usuário")) {
    const currentUser = await getLocalUserById(user.id);
    return {
      tool: "summarize_entity",
      success: true,
      summary: "perfil atual",
      actions: buildPromptActions(context),
      reply: compactMultiline([
        `Resumo do seu perfil atual: ${displayName(currentUser)}`,
        `Login: ${currentUser?.user ?? currentUser?.email ?? user.email}`,
        `Email: ${currentUser?.email ?? user.email}`,
        `Papel: ${displayRole(user)}`,
        `Empresa/tenant atual: ${context.companySlug ?? user.companySlug ?? "global"}`,
        "Posso usar esse contexto para estruturar chamado, comentario, resumo e outras acoes dentro do seu escopo.",
      ].join("\n")),
    };
  }

  const ticket = await findVisibleTicket(user, message);
  if (ticket) {
    const comments = await listTicketComments(ticket.id, { limit: 20, offset: 0 });
    return {
      tool: "summarize_entity",
      success: true,
      summary: ticket.code,
      actions: [
        { kind: "prompt", label: "Gerar caso de teste", prompt: `Gerar caso de teste para o chamado ${ticket.code}` },
        { kind: "prompt", label: "Montar comentario tecnico", prompt: `Montar comentario tecnico para o chamado ${ticket.code}` },
      ],
      reply: compactMultiline([
        `${ticket.code} — ${ticket.title}`,
        `Status: ${ticket.status} | Prioridade: ${ticket.priority} | Tipo: ${ticket.type}`,
        `Criado por: ${ticket.createdByName ?? "nao identificado"} em ${formatDateTime(ticket.createdAt)}`,
        `Responsavel atual: ${ticket.assignedToName ?? "nao definido"}`,
        `Ultima atualizacao: ${formatDateTime(ticket.updatedAt)}`,
        `Comentarios visiveis: ${comments.length}`,
        "",
        "Resumo do conteudo:",
        ticket.description || "Sem descricao detalhada.",
      ].join("\n")),
    };
  }

  if (context.module === "company") {
    const companies = await getVisibleCompanies(user);
    const current = companies.find((item) => normalizeSearch(item.slug) === normalizeSearch(context.companySlug ?? "")) ?? companies[0];
    if (current) {
      return {
        tool: "summarize_entity",
        success: true,
        summary: current.slug,
        actions: buildPromptActions(context),
        reply: compactMultiline([
          `Empresa: ${current.name}`,
          `Slug: ${current.slug}`,
          `Status: ${current.status ?? (current.active === false ? "inativa" : "ativa")}`,
          "Posso agora buscar chamados vinculados a esta empresa, resumir contexto ou sugerir proximo passo.",
        ].join("\n")),
      };
    }
  }

  const currentUser = await getLocalUserById(user.id);
  return {
    tool: "summarize_entity",
    success: true,
    summary: "contexto atual",
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `Resumo do contexto atual para ${displayName(currentUser)}.`,
      `${context.screenLabel}: ${context.screenSummary}`,
      `Perfil ativo: ${displayRole(user)}`,
      `Escopo de empresa: ${context.companySlug ?? user.companySlug ?? "global"}`,
    ].join("\n")),
  };
}

async function toolDraftTestCase(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const ticket = await findVisibleTicket(user, message);
  if (!ticket && looksLikeInstructionOnly(message)) {
    return {
      tool: "draft_test_case",
      success: true,
      summary: "aguardando dados do caso de teste",
      actions: [{ kind: "prompt", label: "Preencher modelo", prompt: buildTestCaseTemplate() }],
      reply: compactMultiline([
        "Antes de montar o caso de teste, preciso validar os dados do modulo de testes.",
        "",
        "Envie o bug, ticket, nota ou contexto funcional real.",
        "",
        buildTestCaseTemplate(),
      ].join("\n")),
    };
  }

  const sourceTitle = ticket?.title ?? buildTicketTitle(message, context);
  const sourceDescription = ticket?.description ?? message;
  const suggestedPriority = ticket?.priority ?? inferTicketPriority(message);
  const structuredDraft = parseStructuredTicketDraft(sourceDescription);
  const severity = suggestedPriority === "high" ? "Alta" : suggestedPriority === "low" ? "Baixa" : "Media";
  const ticketType = ticket?.type ?? structuredDraft?.type ?? "tarefa";
  const objective = structuredDraft?.impact
    ? `Validar o fluxo e confirmar que o impacto relatado foi resolvido: ${structuredDraft.impact}.`
    : ticketType === "bug"
      ? `Validar que o erro descrito em ${sourceTitle.toLowerCase()} nao ocorre mais.`
      : ticketType === "melhoria"
        ? `Validar a melhoria entregue em ${sourceTitle.toLowerCase()} e o comportamento esperado do fluxo.`
        : `Validar o comportamento relacionado a ${sourceTitle.toLowerCase()}.`;
  const reproductionBase = structuredDraft?.currentBehavior || structuredDraft?.description || sourceDescription;
  const expectedResult = structuredDraft?.expectedBehavior || "O fluxo deve concluir sem bloqueio, exibindo estado coerente e respeitando o RBAC do perfil.";
  const validation = validateAssistantTestCaseDraft({
    sourceTitle,
    objective,
    reproductionBase,
    expectedResult,
  });

  if (!validation.ok) {
    return {
      tool: "draft_test_case",
      success: true,
      summary: "pendencias para gerar caso de teste",
      actions: [{ kind: "prompt", label: "Preencher modelo", prompt: buildTestCaseTemplate() }],
      reply: compactMultiline([
        "Antes de gerar o caso de teste, preciso passar pelas validacoes do modulo de testes.",
        "",
        "Pendencias encontradas:",
        formatValidationIssues(validation.issues),
        "",
        buildTestCaseTemplate(),
      ].join("\n")),
    };
  }

  return {
    tool: "draft_test_case",
    success: true,
    summary: validation.sourceTitle,
    actions: ticket
      ? [{ kind: "prompt", label: "Resumir chamado base", prompt: `Resumir o chamado ${ticket.code}` }]
      : buildPromptActions(context),
    reply: compactMultiline([
      `Caso de teste sugerido para: ${validation.sourceTitle}`,
      "",
      "Objetivo:",
      validation.objective,
      "",
      "Pre-condicoes:",
      `1. Usuario com acesso ao modulo ${context.screenLabel}.`,
      "2. Ambiente autenticado e com dados necessarios carregados.",
      ticket?.companySlug ? `3. Contexto ativo da empresa ${ticket.companySlug}.` : "",
      "",
      "Passos:",
      `1. Acessar ${context.route}.`,
      ticketType === "bug"
        ? `2. Reproduzir o erro informado: ${validation.reproductionBase.slice(0, 220)}.`
        : ticketType === "melhoria"
          ? `2. Executar o fluxo da melhoria descrita: ${validation.reproductionBase.slice(0, 220)}.`
          : `2. Executar o fluxo descrito: ${validation.reproductionBase.slice(0, 220)}.`,
      "3. Registrar a resposta visual, funcional e os dados apresentados pelo sistema.",
      ticketType === "bug"
        ? "4. Confirmar que o erro anterior nao volta a ocorrer no mesmo contexto."
        : ticketType === "melhoria"
          ? "4. Confirmar que a melhoria ficou disponivel e coerente com o fluxo esperado."
          : "4. Confirmar que o comportamento final respeita o fluxo esperado.",
      "",
      "Resultado esperado:",
      validation.expectedResult,
      "",
      `Severidade/prioridade sugerida: ${severity}.`,
    ].join("\n")),
  };
}

function buildRoutePermissionExplanation(route: string, permissions: PermissionMatrix | null | undefined) {
  const normalizedRoute = sanitizeRoute(route);

  if (normalizedRoute.startsWith("/admin/support") || normalizedRoute.startsWith("/kanban-it")) {
    const canViewGlobal =
      hasPermissionAccess(permissions, "tickets", "view_all") &&
      (
        hasPermissionAccess(permissions, "tickets", "assign") ||
        hasPermissionAccess(permissions, "tickets", "status") ||
        hasPermissionAccess(permissions, "support", "assign") ||
        hasPermissionAccess(permissions, "support", "status")
      );

    return {
      label: "Kanban global de suporte",
      allowed: canViewGlobal,
      reason: canViewGlobal
        ? "O perfil possui visao global de tickets e acao operacional de suporte."
        : "Para ver o Kanban global, o perfil precisa combinar tickets:view_all com assign/status de tickets ou support.",
    };
  }

  if (normalizedRoute.startsWith("/admin/users/permissions")) {
    const allowed = hasPermissionAccess(permissions, "permissions", "view");
    return {
      label: "Gestao de permissoes por usuario",
      allowed,
      reason: allowed
        ? "O perfil possui permissions:view."
        : "Esse acesso depende de permissions:view.",
    };
  }

  if (normalizedRoute.startsWith("/empresas") || normalizedRoute.startsWith("/admin/clients")) {
    const allowed = hasPermissionAccess(permissions, "applications", "view");
    return {
      label: "Tela de empresas",
      allowed,
      reason: allowed
        ? "O perfil possui applications:view."
        : "Esse acesso depende de applications:view.",
    };
  }

  if (normalizedRoute.startsWith("/admin") || normalizedRoute.startsWith("/dashboard")) {
    const allowed = hasPermissionAccess(permissions, "dashboard", "view");
    return {
      label: "Painel administrativo",
      allowed,
      reason: allowed
        ? "O perfil possui dashboard:view e pode acessar o painel administrativo."
        : "Esse acesso depende de dashboard:view.",
    };
  }

  return {
    label: "Tela atual",
    allowed: true,
    reason: "Nao ha uma regra especializada mapeada para esta rota; o agente usa o escopo efetivo da sessao.",
  };
}

async function toolExplainPermission(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const canInspectOthers = hasPermissionAccess(user.permissions, "users", "view_all");
  const normalized = normalizeText(message);
  const targetIdentifierMatch = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[0-9a-f]{8}-[0-9a-f-]{27}\b/i);
  let targetUser = null as Awaited<ReturnType<typeof findLocalUserByEmailOrId>>;
  let targetPermissions = user.permissions;
  let targetLabel = "perfil atual";

  if (canInspectOthers && targetIdentifierMatch?.[0]) {
    targetUser = await findLocalUserByEmailOrId(targetIdentifierMatch[0]);
    if (targetUser) {
      const resolved = await resolvePermissionAccessForUser(targetUser.id);
      targetPermissions = resolved.permissions;
      targetLabel = displayName(targetUser);
    }
  }

  const explanation = buildRoutePermissionExplanation(context.route, targetPermissions);
  return {
    tool: "explain_permission",
    success: true,
    summary: explanation.label,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `${targetLabel} — ${explanation.label}`,
      explanation.allowed ? "Acesso permitido." : "Acesso nao permitido.",
      explanation.reason,
      "",
      `Permissoes consideradas: ${summarizePermissionMatrix(targetPermissions)}`,
    ].join("\n")),
  };
}

async function toolSuggestNextStep(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const suggestions: string[] = [];

  if (context.module === "support") {
    suggestions.push("Buscar tickets de alta prioridade sem responsavel.");
    suggestions.push("Resumir um chamado pelo ID para acelerar triagem.");
    if (hasPermissionAccess(user.permissions, "tickets", "create") || hasPermissionAccess(user.permissions, "support", "create")) {
      suggestions.push("Transformar um relato solto em chamado estruturado.");
    }
  }

  if (context.module === "permissions") {
    suggestions.push("Explicar por que um perfil nao ve um modulo.");
    suggestions.push("Listar acoes disponiveis para o usuario analisado.");
  }

  if (context.module === "test_plans") {
    suggestions.push("Gerar caso de teste a partir do bug atual.");
  }

  if (!suggestions.length) {
    suggestions.push("Mostrar o contexto atual.");
    suggestions.push("Buscar registros internos visiveis no seu escopo.");
    suggestions.push("Explicar permissoes da tela atual.");
  }

  return {
    tool: "suggest_next_step",
    success: true,
    summary: "proximos passos sugeridos",
    actions: suggestions.slice(0, 4).map((prompt) => ({ kind: "prompt", label: prompt, prompt })),
    reply: suggestions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
  };
}

async function buildTicketCreationAction(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  if (
    !hasPermissionAccess(user.permissions, "tickets", "create") &&
    !hasPermissionAccess(user.permissions, "support", "create")
  ) {
    return {
      tool: "create_ticket",
      success: false,
      summary: "sem permissao para criar ticket",
      reply: "Seu perfil atual nao pode criar chamados. Posso ajudar a estruturar o texto, mas a criacao exige permissao de tickets/support:create.",
    };
  }

  if (isGenericTicketPrompt(message)) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "aguardando conteudo do chamado",
      actions: [
        { kind: "prompt", label: "Usar modelo de chamado", prompt: "Montar modelo de chamado estruturado" },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: compactMultiline([
        "Consigo transformar texto, nota ou relato em chamado, mas preciso do conteudo real para estruturar.",
        "",
        "Envie algo como:",
        "- Converter esta nota em chamado: [cole o texto aqui]",
        "- Criar chamado com base neste relato: [cole o relato aqui]",
        "",
        "Quando voce mandar o conteudo, eu preparo titulo, descricao, tipo e prioridade antes de criar.",
      ].join("\n")),
    };
  }

  const structuredDraft = parseStructuredTicketDraft(message);
  if (structuredDraft?.hasNamedFields) {
    if (!structuredDraft.title || !structuredDraft.description) {
      return {
        tool: "create_ticket",
        success: true,
        summary: "faltam campos para estruturar o chamado",
        actions: [
          {
            kind: "prompt",
            label: "Completar modelo",
            prompt: [
              "Criar chamado estruturado:",
              `Titulo: ${structuredDraft.title}`,
              `Descricao: ${structuredDraft.description}`,
              `Impacto: ${structuredDraft.impact}`,
              `Comportamento esperado: ${structuredDraft.expectedBehavior}`,
              `Comportamento atual: ${structuredDraft.currentBehavior}`,
              `Tipo: ${structuredDraft.type ?? "bug"}`,
              `Prioridade: ${structuredDraft.priority ?? "media"}`,
            ].join("\n"),
          },
        ],
        reply: compactMultiline([
          "Identifiquei um modelo estruturado de chamado, mas ele ainda nao passou nas validacoes do modulo.",
          "",
          "Pendencias encontradas:",
          formatValidationIssues([
            !structuredDraft.title ? "Campo Titulo obrigatorio." : "",
            !structuredDraft.description ? "Campo Descricao obrigatorio." : "",
          ].filter(Boolean)),
          "",
          buildStructuredTicketTemplate(),
        ].join("\n")),
      };
    }

    const title = structuredDraft.title.slice(0, 110);
    const description = buildStructuredTicketDescription(structuredDraft, context);
    const type = structuredDraft.type ?? inferTicketType(message, context);
    const priority = structuredDraft.priority ?? inferTicketPriority(message);
    const validation = validateAssistantTicketDraft({ title, description, type, priority });

    if (!validation.ok) {
      return {
        tool: "create_ticket",
        success: true,
        summary: "pendencias para criar chamado",
        actions: [
          {
            kind: "prompt",
            label: "Completar modelo",
            prompt: buildStructuredTicketTemplate(),
          },
        ],
        reply: compactMultiline([
          "Identifiquei o modelo estruturado, mas ele ainda nao passou nas validacoes do modulo de suporte.",
          "",
          "Pendencias encontradas:",
          formatValidationIssues(validation.issues),
          "",
          buildStructuredTicketTemplate(),
        ].join("\n")),
      };
    }

    return {
      tool: "create_ticket",
      success: true,
      summary: validation.title,
      actions: [
        {
          kind: "tool",
          label: "Criar chamado agora",
          tool: "create_ticket",
          input: {
            title: validation.title,
            description: validation.description,
            type: validation.type,
            priority: validation.priority,
            companySlug: context.companySlug ?? user.companySlug ?? null,
          },
        },
      ],
      reply: compactMultiline([
        "Preparei um chamado estruturado a partir dos campos informados.",
        "",
        `Titulo: ${validation.title}`,
        `Tipo: ${validation.type}`,
        `Prioridade: ${validation.priority}`,
        "",
        validation.description,
        "",
        "Se estiver ok, execute a acao abaixo para criar no sistema.",
      ].join("\n")),
    };
  }

  const narrativeSource = extractNarrativePayload(message) || extractTicketNarrativeSource(message);
  if (!narrativeSource || narrativeSource.length < 12) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "aguardando conteudo do chamado",
      actions: [
        { kind: "prompt", label: "Usar modelo de chamado", prompt: "Montar modelo de chamado estruturado" },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: compactMultiline([
        "Antes de criar o chamado, preciso validar os dados do modulo de suporte.",
        "",
        "O texto enviado ainda esta generico demais para passar nas validacoes.",
        "",
        buildStructuredTicketTemplate(),
      ].join("\n")),
    };
  }

  if (isTicketTemplateRequest(message)) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "modelo de chamado estruturado",
      actions: [
        {
          kind: "prompt",
          label: "Preencher modelo",
          prompt: [
            "Criar chamado estruturado:",
            "Titulo:",
            "Descricao:",
            "Impacto:",
            "Comportamento esperado:",
            "Comportamento atual:",
            "Tipo: bug",
            "Prioridade: media",
          ].join("\n"),
        },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: buildStructuredTicketTemplate(),
    };
  }

  const title = buildTicketTitle(narrativeSource, context);
  const description = buildTicketDescription(narrativeSource, context);
  const type = inferTicketType(narrativeSource, context);
  const priority = inferTicketPriority(narrativeSource);
  const validation = validateAssistantTicketDraft({ title, description, type, priority });

  if (!validation.ok) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "pendencias para criar chamado",
      actions: [
        { kind: "prompt", label: "Usar modelo de chamado", prompt: "Montar modelo de chamado estruturado" },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: compactMultiline([
        "Antes de criar o chamado, preciso passar pelas validacoes do modulo de suporte.",
        "",
        "Pendencias encontradas:",
        formatValidationIssues(validation.issues),
        "",
        buildStructuredTicketTemplate(),
      ].join("\n")),
    };
  }

  return {
    tool: "create_ticket",
    success: true,
    summary: validation.title,
    actions: [
      {
        kind: "tool",
        label: "Criar chamado agora",
        tool: "create_ticket",
        input: {
          title: validation.title,
          description: validation.description,
          type: validation.type,
          priority: validation.priority,
          companySlug: context.companySlug ?? user.companySlug ?? null,
        },
      },
    ],
    reply: compactMultiline([
      "Preparei um rascunho de chamado e ele passou nas validacoes do modulo de suporte.",
      "",
      `Titulo: ${validation.title}`,
      `Tipo: ${validation.type}`,
      `Prioridade: ${validation.priority}`,
      "",
      validation.description,
      "",
      "Se estiver ok, execute a acao abaixo para criar no sistema.",
    ].join("\n")),
  };
}

async function executeCreateTicket(user: AuthUser, context: AssistantScreenContext, action: AssistantToolAction): Promise<AssistantExecutorResult> {
  if (
    !hasPermissionAccess(user.permissions, "tickets", "create") &&
    !hasPermissionAccess(user.permissions, "support", "create")
  ) {
    return {
      tool: "create_ticket",
      success: false,
      summary: "criacao bloqueada",
      reply: "Seu perfil atual nao pode criar chamados.",
    };
  }

  const validation = validateAssistantTicketDraft({
    title: action.input.title,
    description: action.input.description,
    type: action.input.type,
    priority: action.input.priority,
  });

  if (!validation.ok) {
    return {
      tool: "create_ticket",
      success: false,
      summary: "validacao do chamado falhou",
      reply: compactMultiline([
        "Nao executei a criacao porque o chamado nao passou nas validacoes do modulo de suporte.",
        "",
        formatValidationIssues(validation.issues),
      ].join("\n")),
    };
  }

  const localUser = await getLocalUserById(user.id);
  const companySlug = normalizeText(action.input.companySlug, 120) || context.companySlug || user.companySlug || "";
  const company = companySlug ? await findLocalCompanyBySlug(companySlug) : null;
  const ticket = await createTicket({
    title: validation.title,
    description: validation.description,
    type: validation.type,
    priority: validation.priority,
    createdBy: user.id,
    createdByName: displayName(localUser),
    createdByEmail: localUser?.email ?? user.email,
    companyId: company?.id ?? user.companyId ?? null,
    companySlug: company?.slug ?? user.companySlug ?? null,
  });

  if (!ticket) {
    return {
      tool: "create_ticket",
      success: false,
      summary: "falha ao criar",
      reply: "Nao consegui criar o chamado. Verifique se titulo ou descricao ficaram vazios.",
    };
  }

  appendTicketEvent({
    ticketId: ticket.id,
    type: "CREATED",
    actorUserId: user.id,
    payload: { source: "assistant", route: context.route },
  }).catch(() => null);

  notifyTicketCreated(ticket).catch(() => null);

  const enriched = await attachAssigneeToTicket(ticket);
  return {
    tool: "create_ticket",
    success: true,
    summary: ticket.code,
    actions: [
      { kind: "prompt", label: "Resumir chamado criado", prompt: `Resumir o chamado ${ticket.code}` },
      { kind: "prompt", label: "Sugerir caso de teste", prompt: `Gerar caso de teste para o chamado ${ticket.code}` },
    ],
    reply: compactMultiline([
      "Chamado criado com sucesso.",
      "",
      formatTicketCard(enriched),
    ].join("\n")),
  };
}

async function buildCommentCreationAction(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const ticket = await findVisibleTicket(user, message);
  if (!ticket) {
    return {
      tool: "create_comment",
      success: false,
      summary: "ticket nao identificado",
      reply: "Preciso do ID/codigo do chamado para montar o comentario. Exemplo: `Comentar no chamado SP-000027 ...`",
      actions: buildPromptActions(context),
    };
  }

  if (!canCommentTicket(user, ticket)) {
    return {
      tool: "create_comment",
      success: false,
      summary: "sem permissao para comentar",
      reply: `Seu perfil nao pode comentar no chamado ${ticket.code}.`,
    };
  }

  const recentComments = await listTicketComments(ticket.id, { limit: 5, offset: 0 });
  const extractedBody = extractCommentBody(message);
  const body = isGenericCommentRequest(message, extractedBody)
    ? buildDraftCommentFromTicket(ticket, recentComments.length)
    : extractedBody;
  const validation = validateAssistantCommentBody(body);
  if (!validation.ok) {
    return {
      tool: "create_comment",
      success: true,
      summary: "pendencias para comentar",
      reply: compactMultiline([
        `Antes de publicar no chamado ${ticket.code}, preciso passar pelas validacoes do modulo de comentarios.`,
        "",
        formatValidationIssues(validation.issues),
        "",
        `Exemplo: comentar no chamado ${ticket.code} com [seu texto tecnico aqui]`,
      ].join("\n")),
    };
  }

  const duplicateComment = recentComments.find(
    (comment) => normalizeCommentForComparison(comment.body) === normalizeCommentForComparison(validation.body),
  );
  if (duplicateComment) {
    return {
      tool: "create_comment",
      success: true,
      summary: "comentario ja existente",
      actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
      reply: compactMultiline([
        `Ja existe um comentario muito parecido no chamado ${ticket.code}.`,
        "",
        `Ultimo registro similar: ${formatDateTime(duplicateComment.updatedAt)}`,
        "Se precisar, posso montar uma atualizacao diferente ou resumir o chamado antes de comentar de novo.",
      ].join("\n")),
    };
  }

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [
      {
        kind: "tool",
        label: "Publicar comentario",
        tool: "create_comment",
        input: { ticketId: ticket.id, body: validation.body },
      },
    ],
    reply: compactMultiline([
      `Comentario pronto para ${ticket.code}.`,
      "",
      validation.body,
      "",
      "Se estiver ok, execute a acao abaixo para publicar no chamado.",
    ].join("\n")),
  };
}

async function executeCreateComment(user: AuthUser, action: AssistantToolAction): Promise<AssistantExecutorResult> {
  const ticketId = normalizeText(action.input.ticketId, 80);
  const validation = validateAssistantCommentBody(action.input.body);
  if (!ticketId || !validation.ok) {
    return {
      tool: "create_comment",
      success: false,
      summary: "dados invalidos",
      reply: compactMultiline([
        "Nao consegui publicar o comentario porque ele nao passou nas validacoes do modulo de comentarios.",
        "",
        ...(validation.issues.length ? [formatValidationIssues(validation.issues)] : ["Identificador do chamado ausente."]),
      ].join("\n")),
    };
  }

  const ticket = await getTicketById(ticketId);
  if (!ticket || !canViewTicket(user, ticket)) {
    return {
      tool: "create_comment",
      success: false,
      summary: "ticket nao encontrado",
      reply: "Esse chamado nao esta disponivel para o seu perfil atual.",
    };
  }

  if (!canCommentTicket(user, ticket)) {
    return {
      tool: "create_comment",
      success: false,
      summary: "comentario bloqueado",
      reply: `Seu perfil nao pode comentar no chamado ${ticket.code}.`,
    };
  }

  const recentComments = await listTicketComments(ticket.id, { limit: 5, offset: 0 });
  const duplicateComment = recentComments.find(
    (comment) => normalizeCommentForComparison(comment.body) === normalizeCommentForComparison(validation.body),
  );
  if (duplicateComment) {
    return {
      tool: "create_comment",
      success: false,
      summary: "comentario duplicado bloqueado",
      reply: compactMultiline([
        `Nao publiquei o comentario porque ja existe um registro muito parecido no chamado ${ticket.code}.`,
        "",
        `Comentario similar atualizado em ${formatDateTime(duplicateComment.updatedAt)}.`,
      ].join("\n")),
    };
  }

  const localUser = await getLocalUserById(user.id);
  const comment = await createTicketComment({
    ticketId: ticket.id,
    authorUserId: user.id,
    authorName: displayName(localUser),
    body: validation.body,
  });

  if (!comment) {
    return {
      tool: "create_comment",
      success: false,
      summary: "falha ao comentar",
      reply: "Nao consegui publicar o comentario. Verifique se o texto nao ficou vazio.",
    };
  }

  await touchTicket(ticket.id, user.id).catch(() => null);

  appendTicketEvent({
    ticketId: ticket.id,
    type: "COMMENT_ADDED",
    actorUserId: user.id,
    payload: { commentId: comment.id, source: "assistant" },
  }).catch(() => null);

  notifyTicketCommentAdded({
    ticket,
    comment,
    actorId: user.id,
    actorName: displayName(localUser),
  }).catch(() => null);

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
    reply: `Comentario publicado com sucesso no chamado ${ticket.code}.`,
  };
}

function chooseTool(message: string, context: AssistantScreenContext, history: AssistantConversationTurn[]): AssistantToolName {
  const normalized = normalizeSearch(message);

  if (isGreetingPrompt(message)) return "get_screen_context";
  if (!normalized) return "get_screen_context";
  if (/(perfil|meus dados|meu usuario|meu usuário)/.test(normalized)) {
    return "summarize_entity";
  }
  if (/(mostrar|mostra|ver|ver meu).*(contexto|contexto atual)|contexto atual/.test(normalized)) {
    return "get_screen_context";
  }
  if (/(escopo de acesso|meu acesso|explicar meu acesso|explicar meu escopo)/.test(normalized)) {
    return "explain_permission";
  }
  if (/(acoes disponiveis|ações disponíveis|o que voce pode fazer|o que você pode fazer|o que posso fazer)/.test(normalized)) {
    return "list_available_actions";
  }
  if (/(por que|porque).*(nao ve|nao acessa|não vê|não acessa)|permiss/.test(normalized)) {
    return "explain_permission";
  }
  if (/(caso de teste|teste).*(gera|gerar|monta|montar|cria|criar)|gera.*caso de teste/.test(normalized)) {
    return "draft_test_case";
  }
  if (/(coment|responde|responder|comentario|comentário)/.test(normalized) && /(ticket|chamado|sp-|\b\d{2,8}\b)/.test(normalized)) {
    return "create_comment";
  }
  if (/(modelo).*(ticket|chamado)|\b(titulo|título).*(descricao|descrição).*(impacto)/.test(normalized)) {
    return "create_ticket";
  }
  if (/(cria|criar|abre|abrir|transforma|transformar|monta|montar|converte|converter).*(ticket|chamado|suporte|nota)/.test(normalized)) {
    return "create_ticket";
  }
  if (/(coment|responde|responder|comentario|comentário)/.test(normalized) && /(ticket|chamado|sp-|\b\d{2,8}\b)/.test(normalized)) {
    return "create_comment";
  }
  if (/(resum|sumario|sumário)/.test(normalized)) {
    return "summarize_entity";
  }
  if (/(buscar|busca|procura|procurar|localiza|localizar|encontra|encontrar|listar|lista)/.test(normalized) || Boolean(extractTicketReference(message))) {
    return "search_internal_records";
  }
  if (/(proximo passo|próximo passo|o que faco agora|o que faço agora|sugere)/.test(normalized)) {
    return "suggest_next_step";
  }
  if (isAwaitingTicketPayload(history) && (looksLikeFreeformContent(message) || Boolean(parseStructuredTicketDraft(message)) || Boolean(extractNarrativePayload(message)))) {
    return "create_ticket";
  }
  if (isAwaitingTestCasePayload(history) && looksLikeFreeformContent(message)) {
    return "draft_test_case";
  }
  if (context.module === "support") return "search_internal_records";
  return "suggest_next_step";
}

async function executeTool(user: AuthUser, context: AssistantScreenContext, tool: AssistantToolName, message: string) {
  switch (tool) {
    case "get_screen_context":
      return toolGetScreenContext(user, context);
    case "list_available_actions":
      return toolListAvailableActions(user, context);
    case "search_internal_records":
      return toolSearchInternalRecords(user, context, message);
    case "summarize_entity":
      return toolSummarizeEntity(user, context, message);
    case "draft_test_case":
      return toolDraftTestCase(user, context, message);
    case "explain_permission":
      return toolExplainPermission(user, context, message);
    case "create_ticket":
      return buildTicketCreationAction(user, context, message);
    case "create_comment":
      return buildCommentCreationAction(user, context, message);
    case "suggest_next_step":
      return toolSuggestNextStep(user, context);
    default:
      return toolSuggestNextStep(user, context);
  }
}

async function executeToolAction(user: AuthUser, context: AssistantScreenContext, action: AssistantToolAction) {
  switch (action.tool) {
    case "create_ticket":
      return executeCreateTicket(user, context, action);
    case "create_comment":
      return executeCreateComment(user, action);
    default:
      return {
        tool: "suggest_next_step" as AssistantToolName,
        success: false,
        summary: "acao nao suportada",
        reply: "Essa acao nao esta disponivel neste MVP do agente.",
      };
  }
}

export async function runAssistantRequest(user: AuthUser, request: AssistantClientRequest): Promise<AssistantReplyPayload> {
  const context = resolveAssistantScreenContext(sanitizeRoute(request.context?.route));
  const action = request.action;
  const message = normalizePromptText(request.message, 3000);
  const history = normalizeConversationHistory(request.history);

  let result: AssistantExecutorResult;
  if (action?.kind === "tool") {
    result = await executeToolAction(user, context, action);
  } else {
    if (!isAwaitingTicketPayload(history) && !isAwaitingTestCasePayload(history) && isLowSignalMessage(message)) {
      result = buildClarifyReply(context);
    } else {
    const tool = chooseTool(message, context, history);
    result = shouldShortCircuitRepeatedPrompt(history, tool, message)
      ? buildRecentDuplicateReply(tool, context)
      : await executeTool(user, context, tool, message);
    }
  }

  result.actions = maybeCollapseRepeatedActions(result.actions, history);

  await appendAssistantAuditEntry({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    route: context.route,
    module: context.module,
    actionType: action?.kind === "tool" ? "tool" : "message",
    prompt: action?.kind === "tool" ? null : message || null,
    toolName: result.tool,
    success: result.success,
    summary: result.summary,
  }).catch(() => null);

  return reply(result.tool, context, result);
}
