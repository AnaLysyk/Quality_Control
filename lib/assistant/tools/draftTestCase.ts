import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantScreenContext } from "../types";
import type { TicketPriority, TicketType } from "@/lib/ticketsStore";
import { compactMultiline, normalizeSearch } from "../helpers";
import { buildPromptActions, findVisibleTicket } from "../data";
import { looksLikeInstructionOnly, validateAssistantTestCaseDraft } from "../validations";
import { formatValidationIssues } from "../helpers";
import { TEST_CASE_TEMPLATE_LINES } from "../messages";
import { buildTicketTitle, inferTicketPriority, parseStructuredTicketDraft } from "./ticketHelpers";
import type { AssistantExecutorResult } from "./types";

function buildTestCaseTemplate() {
  return compactMultiline(TEST_CASE_TEMPLATE_LINES.join("\n"));
}

export async function toolDraftTestCase(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
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
  const suggestedPriority: TicketPriority = ticket?.priority ?? inferTicketPriority(message);
  const structuredDraft = parseStructuredTicketDraft(sourceDescription);
  const severity = suggestedPriority === "high" ? "Alta" : suggestedPriority === "low" ? "Baixa" : "Media";
  const ticketType: TicketType = ticket?.type ?? structuredDraft?.type ?? "tarefa";

  const objective = structuredDraft?.impact
    ? `Validar o fluxo e confirmar que o impacto relatado foi resolvido: ${structuredDraft.impact}.`
    : ticketType === "bug"
      ? `Validar que o erro descrito em ${sourceTitle.toLowerCase()} nao ocorre mais.`
      : ticketType === "melhoria"
        ? `Validar a melhoria entregue em ${sourceTitle.toLowerCase()} e o comportamento esperado do fluxo.`
        : `Validar o comportamento relacionado a ${sourceTitle.toLowerCase()}.`;

  const reproductionBase = structuredDraft?.currentBehavior || structuredDraft?.description || sourceDescription;
  const expectedResult = structuredDraft?.expectedBehavior || "O fluxo deve concluir sem bloqueio, exibindo estado coerente e respeitando o RBAC do perfil.";

  const validation = validateAssistantTestCaseDraft({ sourceTitle, objective, reproductionBase, expectedResult });

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
