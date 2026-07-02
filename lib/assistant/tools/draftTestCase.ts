import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantAction, AssistantScreenContext } from "../types";
import type { TicketPriority, TicketType } from "@/lib/ticketsStore";
import { compactMultiline } from "../helpers";
import { buildPromptActions, findVisibleTicket } from "../data";
import { looksLikeInstructionOnly, validateAssistantTestCaseDraft } from "../validations";
import { formatValidationIssues } from "../helpers";
import { TEST_CASE_TEMPLATE_LINES } from "../messages";
import { buildTicketTitle, inferTicketPriority, parseStructuredTicketDraft } from "./ticketHelpers";
import type { AssistantExecutorResult } from "./types";

function buildTestCaseTemplate() {
  return compactMultiline(TEST_CASE_TEMPLATE_LINES.join("\n"));
}

function getTypeEmoji(type: TicketType): string {
  switch (type) {
    case "bug": return "ðŸ›";
    case "melhoria": return "âœ¨";
    case "tarefa": return "ðŸ“‹";
    default: return "ðŸ“";
  }
}

function getSeverityEmoji(priority: TicketPriority): string {
  switch (priority) {
    case "high": return "ðŸ”´";
    case "medium": return "ðŸŸ ";
    case "low": return "ðŸŸ¢";
    default: return "âšª";
  }
}

function priorityToTestCasePriority(priority: TicketPriority) {
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function metadataText(context: AssistantScreenContext, key: string) {
  const value = context.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildCreationInput(args: {
  user: AuthUser;
  context: AssistantScreenContext;
  ticket: Awaited<ReturnType<typeof findVisibleTicket>>;
  ticketType: TicketType;
  priority: TicketPriority;
  sourceTitle: string;
  objective: string;
  reproductionBase: string;
  expectedResult: string;
}) {
  const companySlug = args.ticket?.companySlug ?? args.context.companySlug ?? args.user.companySlug ?? null;
  const title = clip(args.ticket ? `${args.ticket.code} - ${args.sourceTitle}` : args.sourceTitle, 120);
  const route = args.context.route || "/";
  const flowText = clip(args.reproductionBase, 220);
  const moduleId = metadataText(args.context, "moduleId") ?? (args.context.module !== "general" ? args.context.module : undefined);
  const applicationId = metadataText(args.context, "applicationId");
  const baseTags = [
    "assistant-ai",
    args.ticketType,
    args.context.module !== "general" ? args.context.module : "",
    args.ticket?.code ? args.ticket.code.toLowerCase() : "",
  ].filter(Boolean);

  const secondStepAction =
    args.ticketType === "bug"
      ? `Reproduzir o comportamento reportado: ${flowText}`
      : args.ticketType === "melhoria"
        ? `Executar o fluxo da melhoria: ${flowText}`
        : `Executar o fluxo principal: ${flowText}`;

  return {
    title,
    description: compactMultiline([
      args.ticket ? `Caso criado a partir do chamado ${args.ticket.code}.` : "Caso criado a partir de contexto informado ao assistente.",
      args.ticket?.description ? clip(args.ticket.description, 700) : clip(args.reproductionBase, 700),
    ].join("\n")),
    objective: args.objective,
    preconditions: compactMultiline([
      `Usuario autenticado com acesso ao modulo ${args.context.screenLabel}.`,
      "Ambiente com dados necessarios para executar o fluxo.",
      companySlug ? `Empresa ativa: ${companySlug}.` : "",
    ].join("\n")),
    postconditions: "Resultado revisado e evidencia registrada no ciclo de QA.",
    type: "manual",
    status: "draft",
    priority: priorityToTestCasePriority(args.priority),
    companySlug,
    applicationId,
    moduleId,
    tags: baseTags,
    steps: [
      {
        action: `Acessar ${route}`,
        expectedResult: `${args.context.screenLabel} carrega sem erro e dentro do escopo do usuario.`,
      },
      {
        action: secondStepAction,
        expectedResult: "O sistema permite executar o fluxo sem bloqueios inesperados.",
      },
      {
        action: "Validar mensagens, estados visuais e dados exibidos.",
        expectedResult: args.expectedResult,
      },
      {
        action: "Registrar evidencia funcional da execucao.",
        expectedResult: "Evidencia suficiente fica disponivel para revisao do caso.",
      },
    ],
  };
}

export async function toolDraftTestCase(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const ticket = await findVisibleTicket(user, message);
  
  if (!ticket && looksLikeInstructionOnly(message)) {
    return {
      tool: "draft_test_case",
      success: true,
      summary: "aguardando dados do caso de teste",
      actions: [{ kind: "prompt", label: "ðŸ“ Preencher modelo", prompt: buildTestCaseTemplate() }],
      reply: compactMultiline([
        "## ðŸ§ª Gerador de Caso de Teste",
        "",
        "âš ï¸ **Preciso de mais informações** antes de montar o caso de teste.",
        "",
        "Envie:",
        "- ðŸ› Um **bug** com descrição do erro",
        "- ðŸŽ« Um **ticket** ou código (ex: SP-000001)",
        "- ðŸ“‹ Uma **descrição do fluxo** a ser testado",
        "",
        "---",
        "",
        "### ðŸ“„ Modelo sugerido:",
        "",
        buildTestCaseTemplate(),
      ].join("\n")),
    };
  }

  const sourceTitle = ticket?.title ?? buildTicketTitle(message, context);
  const sourceDescription = ticket?.description ?? message;
  const suggestedPriority: TicketPriority = ticket?.priority ?? inferTicketPriority(message);
  const structuredDraft = parseStructuredTicketDraft(sourceDescription);
  const severity = suggestedPriority === "high" ? "Alta" : suggestedPriority === "low" ? "Baixa" : "Média";
  const ticketType: TicketType = ticket?.type ?? structuredDraft?.type ?? "tarefa";

  const objective = structuredDraft?.impact
    ? `Validar o fluxo e confirmar que o impacto relatado foi resolvido: ${structuredDraft.impact}.`
    : ticketType === "bug"
      ? `Validar que o erro descrito em "${sourceTitle}" não ocorre mais.`
      : ticketType === "melhoria"
        ? `Validar a melhoria entregue em "${sourceTitle}" e o comportamento esperado.`
        : `Validar o comportamento relacionado a "${sourceTitle}".`;

  const reproductionBase = structuredDraft?.currentBehavior || structuredDraft?.description || sourceDescription;
  const expectedResult = structuredDraft?.expectedBehavior || "O fluxo deve concluir sem bloqueio, exibindo estado coerente e respeitando o RBAC do perfil.";

  const validation = validateAssistantTestCaseDraft({ sourceTitle, objective, reproductionBase, expectedResult });

  if (!validation.ok) {
    return {
      tool: "draft_test_case",
      success: true,
      summary: "pendências para gerar caso de teste",
      actions: [{ kind: "prompt", label: "ðŸ“ Preencher modelo", prompt: buildTestCaseTemplate() }],
      reply: compactMultiline([
        "## ðŸ§ª Caso de Teste — Validação",
        "",
        "âš ï¸ **Pendências encontradas:**",
        "",
        formatValidationIssues(validation.issues),
        "",
        "---",
        "",
        "### ðŸ“„ Complete o modelo:",
        "",
        buildTestCaseTemplate(),
      ].join("\n")),
    };
  }

  const typeEmoji = getTypeEmoji(ticketType);
  const severityEmoji = getSeverityEmoji(suggestedPriority);
  const createTestCaseAction: AssistantAction = {
    kind: "tool",
    label: "Criar caso no repositorio",
    tool: "create_test_case",
    input: buildCreationInput({
      user,
      context,
      ticket,
      ticketType,
      priority: suggestedPriority,
      sourceTitle: validation.sourceTitle,
      objective: validation.objective,
      reproductionBase: validation.reproductionBase,
      expectedResult: validation.expectedResult,
    }),
  };
  const nextActions: AssistantAction[] = ticket
    ? [
        createTestCaseAction,
        { kind: "prompt", label: `Resumir ${ticket.code}`, prompt: `Resumir o chamado ${ticket.code}` },
      ]
    : [createTestCaseAction, ...buildPromptActions(context).slice(0, 3)];

  return {
    tool: "draft_test_case",
    success: true,
    summary: validation.sourceTitle,
    actions: nextActions,
    reply: compactMultiline([
      `## ðŸ§ª Caso de Teste`,
      "",
      `### ${typeEmoji} ${validation.sourceTitle}`,
      "",
      `| Atributo | Valor |`,
      `|----------|-------|`,
      `| **Tipo** | ${typeEmoji} ${ticketType} |`,
      `| **Severidade** | ${severityEmoji} ${severity} |`,
      ticket ? `| **Ticket Base** | ${ticket.code} |` : "",
      `| **Módulo** | ${context.screenLabel} |`,
      "",
      "### ðŸŽ¯ Objetivo:",
      "",
      validation.objective,
      "",
      "### âœ… Pré-condições:",
      "",
      `1. âœ… Usuário autenticado com acesso ao módulo **${context.screenLabel}**`,
      "2. âœ… Ambiente com dados necessários carregados",
      ticket?.companySlug ? `3. âœ… Contexto ativo da empresa **${ticket.companySlug}**` : "",
      "",
      "### ðŸ“ Passos:",
      "",
      `| # | Ação |`,
      `|---|------|`,
      `| 1 | Acessar \`${context.route}\` |`,
      ticketType === "bug"
        ? `| 2 | Reproduzir o erro: ${validation.reproductionBase.slice(0, 150)}${validation.reproductionBase.length > 150 ? "..." : ""} |`
        : ticketType === "melhoria"
          ? `| 2 | Executar o fluxo da melhoria: ${validation.reproductionBase.slice(0, 150)}${validation.reproductionBase.length > 150 ? "..." : ""} |`
          : `| 2 | Executar o fluxo: ${validation.reproductionBase.slice(0, 150)}${validation.reproductionBase.length > 150 ? "..." : ""} |`,
      `| 3 | Registrar resposta visual, funcional e dados apresentados |`,
      ticketType === "bug"
        ? `| 4 | Confirmar que o erro anterior não volta a ocorrer |`
        : ticketType === "melhoria"
          ? `| 4 | Confirmar que a melhoria está disponível e coerente |`
          : `| 4 | Confirmar comportamento final esperado |`,
      "",
      "### âœ¨ Resultado Esperado:",
      "",
      `> ${validation.expectedResult}`,
      "",
      "---",
      "",
      "ðŸ’¡ **Dica:** Use este caso como base e ajuste conforme necessário.",
    ].join("\n")),
  };
}

