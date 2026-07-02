import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { compactMultiline } from "../helpers";
import { buildPromptActions, displayName, displayRole, summarizePermissionMatrix, isEmpresaUser } from "../data";
import type { AssistantScreenContext } from "../types";
import type { AssistantExecutorResult } from "./types";

function firstName(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "usuário";
  return cleaned.split(/\s+/)[0] ?? "usuário";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getOperationsSnapshot(context: AssistantScreenContext) {
  if (context.module !== "operations") return null;

  const metadata = asRecord(context.metadata);
  if (!metadata) return null;

  const filters = asRecord(metadata.filters);
  const metrics = asRecord(metadata.metrics);
  const permissions = asRecord(metadata.permissions);
  const risksRaw = Array.isArray(metadata.risks) ? metadata.risks : [];

  const companyNames = Array.isArray(filters?.companyNames)
    ? filters.companyNames.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const periodLabel = asString(filters?.periodLabel, asString(filters?.period, "nas últimas 24h"));
  const roleLabel = asString(permissions?.role, "operador");

  return {
    companyCount: Array.isArray(filters?.companyIds) ? filters.companyIds.length : companyNames.length,
    companyNames,
    periodLabel,
    failedRuns: asNumber(metrics?.failedRuns),
    blockedRuns: asNumber(metrics?.blockedRuns),
    openDefects: asNumber(metrics?.openDefects),
    itemsWithoutOwner: asNumber(metrics?.itemsWithoutOwner),
    healthScore: asNumber(metrics?.healthScore),
    roleLabel,
    risks: risksRaw
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .slice(0, 3)
      .map((item) => ({
        severity: asString(item.severity, "atenção"),
        title: asString(item.title, "Risco operacional"),
        description: asString(item.description),
      })),
  };
}

function getModuleEmoji(module: string): string {
  switch (module) {
    case "support": return "ðŸŽ«";
    case "dashboard": return "ðŸ“Š";
    case "permissions": return "ðŸ”";
    case "test_plans": return "ðŸ§ª";
    case "company": return "ðŸ¢";
    case "releases": return "ðŸš€";
    case "integrations": return "ðŸ”—";
    case "admin": return "âš™ï¸";
    default: return "ðŸ“";
  }
}

function buildImmediateActions(context: AssistantScreenContext, user: AuthUser): Array<{ emoji: string; text: string }> {
  switch (context.module) {
    case "support":
      return [
        { emoji: "ðŸ”", text: "Localizar chamados por código, status, prioridade ou responsável" },
        { emoji: "ðŸ“‹", text: "Resumir um ticket antes de mover ou comentar" },
        { emoji: "âœï¸", text: "Transformar um relato em chamado estruturado" },
        { emoji: "ðŸ§ª", text: "Gerar caso de teste a partir de um bug" },
      ];
    case "permissions":
      return [
        { emoji: "ðŸ”", text: "Explicar por que um perfil não acessa determinada tela" },
        { emoji: "ðŸ“Š", text: "Comparar escopos entre perfis diferentes" },
        { emoji: "âš™ï¸", text: "Apontar ajustes para liberar ou restringir acesso" },
      ];
    case "company":
      if (isEmpresaUser(user)) {
        return [
          { emoji: "ðŸ¢", text: "Resumir status atual da empresa" },
          { emoji: "ðŸ›", text: "Ver defeitos e bugs ativos no projeto" },
          { emoji: "ðŸ§ª", text: "Consultar planos de teste em andamento" },
          { emoji: "ðŸ“Š", text: "Analisar métricas de qualidade dos testes" },
        ];
      }
      return [
        { emoji: "ðŸ“‹", text: "Resumir a empresa atual e registros vinculados" },
        { emoji: "ðŸ”", text: "Buscar chamados ou usuários desta empresa" },
        { emoji: "ðŸ“Š", text: "Analisar métricas de atendimento" },
        { emoji: "ðŸ”—", text: "Listar integrações ativas" },
      ];
    case "test_plans":
      return [
        { emoji: "ðŸ§ª", text: "Gerar casos de teste a partir de bug ou fluxo" },
        { emoji: "ðŸ“‹", text: "Organizar pré-condições, passos e resultado esperado" },
        { emoji: "âœ…", text: "Validar cobertura de testes existente" },
      ];
    case "dashboard":
      return [
        { emoji: "ðŸ“Š", text: "Analisar métricas de qualidade do período" },
        { emoji: "ðŸŽ¯", text: "Identificar tendências nos indicadores" },
        { emoji: "âš ï¸", text: "Listar áreas que precisam de atenção" },
      ];
    case "releases":
      return [
        { emoji: "ðŸš€", text: "Verificar status do último deploy" },
        { emoji: "ðŸ“¦", text: "Analisar testes pendentes para release" },
        { emoji: "ðŸ“‹", text: "Gerar relatório de qualidade da versão" },
      ];
    default:
      return [
        { emoji: "ðŸ“", text: "Entender o contexto atual e próximos passos" },
        { emoji: "ðŸ”", text: "Buscar registros por palavra-chave ou contexto" },
        { emoji: "ðŸ’¡", text: "Transformar um pedido em ação objetiva" },
      ];
  }
}

function stripScreenLead(context: AssistantScreenContext) {
  const lead = `Você está em: ${context.screenLabel}.`;
  if (context.screenSummary.startsWith(lead)) {
    return context.screenSummary.slice(lead.length).trim();
  }
  return context.screenSummary.trim();
}

function buildScopeLabel(user: AuthUser, context: AssistantScreenContext) {
  return context.companySlug ?? user.companySlug ?? "global";
}

function buildPermissionLine(user: AuthUser) {
  const summary = summarizePermissionMatrix(user.permissions);
  if (summary === "sem módulos liberados") {
    return "âš ï¸ **Permissões:** Nenhum módulo liberado para o perfil atual";
  }
  return `ðŸ” **Permissões:** ${summary}`;
}

export async function toolGetScreenContext(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const currentUser = await getLocalUserById(user.id);

  if (context.route.startsWith("/admin/access-requests")) {
    return {
      tool: "get_screen_context",
      success: true,
      summary: "Solicitacoes de acesso",
      reply: compactMultiline([
        `Estou com voce aqui em Solicitacoes de acesso, ${firstName(displayName(currentUser))}.`,
        "",
        "Meu papel aqui e te ajudar a transformar uma solicitacao em uma decisao segura: aprovar, recusar ou devolver para ajuste sem perder historico.",
        "",
        "O fluxo que eu sigo contigo:",
        "1. Encontrar a pessoa na fila por busca ou filtro.",
        "2. Abrir pelo olho quando voce quiser apenas conferir.",
        "3. Abrir pelo lapis quando precisar analisar ou editar.",
        "4. Comparar o que o solicitante enviou com o perfil que sera criado.",
        "5. Se faltar algo, sugerir os campos para ajuste e uma mensagem objetiva.",
        "6. Se estiver tudo certo, revisar senha, empresa e obrigatorios antes da aprovacao.",
        "7. Se for recusar, garantir motivo/comentario e rastreabilidade em historico/logs.",
        "",
        "Se voce quiser, posso agir agora: buscar alguem, filtrar a fila, abrir a primeira solicitacao ou explicar o que falta para aprovar a solicitacao selecionada.",
      ].join("\n")),
    };
  }

  const actions = buildImmediateActions(context, user);
  const moduleEmoji = getModuleEmoji(context.module);
  const prompts = context.suggestedPrompts.slice(0, 4);
  const operations = getOperationsSnapshot(context);

  if (operations) {
    const userName = firstName(displayName(currentUser));
    const scopeLabel = operations.companyCount <= 1
      ? (operations.companyNames[0] ?? buildScopeLabel(user, context))
      : `${operations.companyCount} empresas selecionadas`;

    const riskLines = operations.risks.length > 0
      ? operations.risks.map((risk, index) => `${index + 1}. ${risk.title}${risk.description ? ` — ${risk.description}` : ""}`)
      : ["1. Sem riscos críticos destacados no recorte atual."];

    return {
      tool: "get_screen_context",
      success: true,
      summary: context.screenLabel,
      actions: buildPromptActions(context),
      reply: compactMultiline([
        `Oi, ${userName}. Estou com a ${context.screenLabel} carregada.`,
        "",
        `No contexto atual, há ${scopeLabel} ${operations.periodLabel}, com ${operations.failedRuns} runs com falha, ${operations.blockedRuns} runs bloqueadas, ${operations.openDefects} defeitos abertos e ${operations.itemsWithoutOwner} itens sem responsável.`,
        operations.healthScore > 0 ? `Saúde operacional atual: ${operations.healthScore}%.` : "Saúde operacional atual em nível crítico e precisa de atenção imediata.",
        "",
        "### Pontos de atenção",
        ...riskLines,
        "",
        "### Posso ajudar com:",
        ...prompts.map((prompt, index) => `${index + 1}. ${prompt}`),
        "",
        `Perfil ativo: ${operations.roleLabel}.`,
      ].join("\n")),
    };
  }

  const replyParts = [
    `## ${moduleEmoji} ${context.screenLabel}`,
    "",
    `> ${stripScreenLead(context)}`,
    "",
    "### ðŸŽ¯ O que posso fazer aqui:",
    "",
    ...actions.map((a) => `- ${a.emoji} ${a.text}`),
    "",
    "### ðŸ’¡ Sugestões rápidas:",
    "",
    ...prompts.map((p, i) => `${i + 1}. ${p}`),
    "",
    "---",
    "",
    "### ðŸ“‹ Contexto Atual:",
    "",
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Módulo** | ${context.module} |`,
    `| **Escopo** | ${buildScopeLabel(user, context)} |`,
    `| **Perfil** | ${displayRole(user)} |`,
    `| **Usuário** | ${displayName(currentUser)} |`,
    "",
    buildPermissionLine(user),
  ];

  return {
    tool: "get_screen_context",
    success: true,
    summary: context.screenLabel,
    actions: buildPromptActions(context),
    reply: compactMultiline(replyParts.join("\n")),
  };
}

