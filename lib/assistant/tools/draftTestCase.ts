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

function getTypeEmoji(type: TicketType): string {
  switch (type) {
    case "bug": return "🐛";
    case "melhoria": return "✨";
    case "tarefa": return "📋";
    default: return "📝";
  }
}

function getSeverityEmoji(priority: TicketPriority): string {
  switch (priority) {
    case "high": return "🔴";
    case "medium": return "🟠";
    case "low": return "🟢";
    default: return "⚪";
  }
}

export async function toolDraftTestCase(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const ticket = await findVisibleTicket(user, message);
  
  if (!ticket && looksLikeInstructionOnly(message)) {
    return {
      tool: "draft_test_case",
      success: true,
      summary: "aguardando dados do caso de teste",
      actions: [{ kind: "prompt", label: "📝 Preencher modelo", prompt: buildTestCaseTemplate() }],
      reply: compactMultiline([
        "## 🧪 Gerador de Caso de Teste",
        "",
        "⚠️ **Preciso de mais informações** antes de montar o caso de teste.",
        "",
        "Envie:",
        "- 🐛 Um **bug** com descrição do erro",
        "- 🎫 Um **ticket** ou código (ex: SP-000001)",
        "- 📋 Uma **descrição do fluxo** a ser testado",
        "",
        "---",
        "",
        "### 📄 Modelo sugerido:",
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
      actions: [{ kind: "prompt", label: "📝 Preencher modelo", prompt: buildTestCaseTemplate() }],
      reply: compactMultiline([
        "## 🧪 Caso de Teste — Validação",
        "",
        "⚠️ **Pendências encontradas:**",
        "",
        formatValidationIssues(validation.issues),
        "",
        "---",
        "",
        "### 📄 Complete o modelo:",
        "",
        buildTestCaseTemplate(),
      ].join("\n")),
    };
  }

  const typeEmoji = getTypeEmoji(ticketType);
  const severityEmoji = getSeverityEmoji(suggestedPriority);

  return {
    tool: "draft_test_case",
    success: true,
    summary: validation.sourceTitle,
    actions: ticket
      ? [
          { kind: "prompt", label: `📋 Resumir ${ticket.code}`, prompt: `Resumir o chamado ${ticket.code}` },
          { kind: "prompt", label: "💾 Salvar caso de teste", prompt: "Salvar este caso de teste" },
        ]
      : buildPromptActions(context),
    reply: compactMultiline([
      `## 🧪 Caso de Teste`,
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
      "### 🎯 Objetivo:",
      "",
      validation.objective,
      "",
      "### ✅ Pré-condições:",
      "",
      `1. ✅ Usuário autenticado com acesso ao módulo **${context.screenLabel}**`,
      "2. ✅ Ambiente com dados necessários carregados",
      ticket?.companySlug ? `3. ✅ Contexto ativo da empresa **${ticket.companySlug}**` : "",
      "",
      "### 📝 Passos:",
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
      "### ✨ Resultado Esperado:",
      "",
      `> ${validation.expectedResult}`,
      "",
      "---",
      "",
      "💡 **Dica:** Use este caso como base e ajuste conforme necessário.",
    ].join("\n")),
  };
}
