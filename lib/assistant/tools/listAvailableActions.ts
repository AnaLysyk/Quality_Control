import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import type { AssistantScreenContext } from "../types";
import { compactMultiline } from "../helpers";
import { buildPromptActions, displayRole, isEmpresaUser } from "../data";
import type { AssistantExecutorResult } from "./types";

type ActionItem = {
  label: string;
  category: "read" | "write" | "analyze" | "agent";
};

export async function toolListAvailableActions(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  if (context.route?.startsWith("/admin/access-requests")) {
    return {
      tool: "list_available_actions",
      success: true,
      summary: "acoes de solicitacoes de acesso",
      reply: compactMultiline([
        "## Acoes que posso realizar nesta tela",
        "",
        `Estou operando como **${displayRole(user)}** em **Solicitacoes de acesso**. Tudo respeita seu RBAC e o que estiver visivel na tela.`,
        "",
        "### Posso agir na interface",
        "",
        "- Filtrar por abertas, novas, em ajuste, aprovadas, recusadas ou todas.",
        "- Buscar solicitante por nome, e-mail, empresa, perfil ou cargo.",
        "- Abrir a primeira solicitacao visivel em modo leitura pelo olho.",
        "- Abrir a analise editavel pelo lapis.",
        "- Acionar o PDF quando o botao estiver disponivel.",
        "",
        "### Posso orientar a decisao",
        "",
        "- Explicar o fluxo de aprovacao, rejeicao e pedido de ajuste.",
        "- Apontar pendencias que impedem aprovacao.",
        "- Sugerir quais campos devolver para ajuste.",
        "- Explicar o que fica no historico, logs e notificacoes.",
        "- Ajudar a escrever uma mensagem clara para o solicitante.",
      ].join("\n")),
    };
  }

  const actions: ActionItem[] = [
    { label: "Ler o contexto da tela atual e explicar o que esta disponivel", category: "read" },
    { label: "Buscar registros visiveis no seu escopo de acesso", category: "read" },
    { label: "Resumir tickets, usuarios, empresas, solicitacoes ou indicadores", category: "read" },
    { label: "Sugerir o proximo passo mais util como agente", category: "agent" },
    { label: "Explicar o impacto de uma acao antes de executar", category: "agent" },
  ];

  if (context.route?.startsWith("/admin/access-requests")) {
    actions.push(
      { label: "Explicar o fluxo de aprovacao, rejeicao e pedido de ajuste", category: "agent" },
      { label: "Apontar pendencias que impedem aprovacao da solicitacao", category: "analyze" },
      { label: "Sugerir campos que devem voltar para ajuste do solicitante", category: "analyze" },
      { label: "Orientar consulta de historico, logs e notificacoes da solicitacao", category: "read" },
    );
  }

  if (context.module === "dashboard") {
    actions.push(
      { label: "Listar modulos administrativos e quando usar cada um", category: "read" },
      { label: "Ajudar a escolher o caminho mais curto para concluir uma tarefa", category: "agent" },
      { label: "Sugerir rotina operacional para fila, logs, usuarios e permissoes", category: "analyze" },
    );
  }

  if (
    hasPermissionAccess(user.permissions, "tickets", "create") ||
    hasPermissionAccess(user.permissions, "support", "create")
  ) {
    actions.push({ label: "Criar chamado a partir de uma descricao", category: "write" });
  }

  if (hasPermissionAccess(user.permissions, "tickets", "comment") || hasPermissionAccess(user.permissions, "support", "comment")) {
    actions.push({ label: "Preparar ou adicionar comentario tecnico em chamado", category: "write" });
  }

  if (context.module === "test_plans" || hasPermissionAccess(user.permissions, "test_plans", "create")) {
    actions.push({ label: "Gerar caso de teste estruturado a partir de bug, requisito ou texto", category: "analyze" });
  }

  if (context.module === "permissions" || hasPermissionAccess(user.permissions, "permissions", "view")) {
    actions.push({ label: "Explicar permissoes, RBAC e escopos de acesso", category: "analyze" });
  }

  if (context.module === "company") {
    if (isEmpresaUser(user)) {
      actions.push(
        { label: "Resumir status atual da empresa", category: "read" },
        { label: "Listar defeitos e bugs ativos no projeto", category: "read" },
        { label: "Analisar metricas de qualidade dos testes", category: "analyze" },
      );
    } else {
      actions.push(
        { label: "Resumir perfil da empresa", category: "read" },
        { label: "Analisar metricas de atendimento", category: "analyze" },
        { label: "Ver usuarios vinculados a empresa", category: "read" },
      );
    }
  }

  actions.push(
    { label: "Analisar metricas e indicadores", category: "analyze" },
    { label: "Transformar uma duvida em plano de execucao passo a passo", category: "agent" },
  );

  const readActions = actions.filter((action) => action.category === "read");
  const writeActions = actions.filter((action) => action.category === "write");
  const analyzeActions = actions.filter((action) => action.category === "analyze");
  const agentActions = actions.filter((action) => action.category === "agent");

  const replyParts = [
    "## Acoes disponiveis",
    "",
    `Operando como **${displayRole(user)}** no modulo **${context.module}**.`,
    "Todas as acoes respeitam seu RBAC e seu escopo de empresa.",
    "",
  ];

  if (agentActions.length) {
    replyParts.push(
      "### Como agente",
      "",
      ...agentActions.map((action) => `- ${action.label}`),
      "",
    );
  }

  if (readActions.length) {
    replyParts.push(
      "### Consultas",
      "",
      ...readActions.map((action) => `- ${action.label}`),
      "",
    );
  }

  if (writeActions.length) {
    replyParts.push(
      "### Criacao ou alteracao",
      "",
      ...writeActions.map((action) => `- ${action.label}`),
      "",
    );
  }

  if (analyzeActions.length) {
    replyParts.push(
      "### Analise",
      "",
      ...analyzeActions.map((action) => `- ${action.label}`),
      "",
    );
  }

  replyParts.push(
    "---",
    "Se quiser, me diga o objetivo final e eu sugiro o caminho mais curto antes de executar qualquer acao sensivel.",
  );

  return {
    tool: "list_available_actions",
    success: true,
    summary: `${actions.length} acoes disponiveis`,
    actions: buildPromptActions(context),
    reply: compactMultiline(replyParts.join("\n")),
  };
}
