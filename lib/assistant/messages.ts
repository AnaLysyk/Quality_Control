/**
 * User-facing messages and templates for the assistant.
 * Centralised here so UX copy can change without touching business logic.
 */

import type { AssistantToolName } from "./types";

/* ──────────────────── Duplicate / repeat messages ──────────────────── */

export const REPEATED_REPLY_MESSAGES: Record<AssistantToolName, string> = {
  get_screen_context:
    "📍 Já te mostrei esse contexto. Se quiser, continuo a conversa focando no que importa agora: **permissões**, **chamados** ou **empresa**.",
  list_available_actions:
    "✅ As ações já estão mapeadas. Me diga qual caminho você quer seguir que eu conduzo o próximo passo.",
  search_internal_records:
    "🔍 Essa busca já foi feita. Posso continuar daqui refinando por **ID**, **status**, **prioridade** ou **responsável**.",
  summarize_entity:
    "📋 Esse resumo já está pronto. Posso aprofundar um ponto específico ou conectar com outra entidade para manter o fluxo.",
  draft_test_case:
    "🧪 O caso de teste já foi gerado nesse contexto. Se quiser, eu continuo e ajusto para **bug**, **melhoria** ou outro cenário.",
  explain_permission:
    "🔐 Esse escopo já foi explicado. Posso continuar comparando com outra tela, perfil ou módulo.",
  create_ticket:
    "🎫 Esse pedido já foi analisado. Para eu continuar no mesmo fluxo, me envie **dados novos** ou o **modelo preenchido**.",
  create_comment:
    "💬 Esse comentário já foi tratado. Se quiser, continuo com uma atualização diferente.",
  suggest_next_step:
    "💡 Os próximos passos já estão sugeridos. Escolha uma opção ou me descreva o objetivo que eu sigo com você.",
  use_brain:
    "Podemos continuar por aqui no mesmo assunto. Me diga o que você quer que eu analise ou execute agora.",
};

/* ──────────────────── Clarify / low-signal ──────────────────── */

export const CLARIFY_REPLY = [
  "🤔 Quero te ajudar do jeito certo, mas ainda faltou um pouco de contexto.",
  "",
  "**Posso seguir com você em:**",
  "• 📍 Resumir o contexto desta tela",
  "• 🔐 Explicar seu escopo de acesso",
  "• 🎫 Criar um chamado a partir de uma descrição",
  "• 🔍 Buscar tickets, usuários ou empresas",
  "• 🧪 Gerar casos de teste",
  "",
  "💡 **Exemplos rápidos para continuarmos o fluxo:**",
  "  - \"buscar tickets de alta prioridade\"",
  "  - \"criar chamado sobre erro no login\"",
  "  - \"explicar por que não vejo o módulo X\"",
].join("\n");

/* ──────────────────── Ticket template ──────────────────── */

export const TICKET_TEMPLATE_LINES = [
  "Use este modelo para eu estruturar melhor o chamado:",
  "",
  "Título:",
  "Descrição:",
  "Impacto:",
  "Comportamento esperado:",
  "Comportamento atual:",
  "Tipo: bug | tarefa | melhoria",
  "Prioridade: baixa | média | alta",
];

/* ──────────────────── Test case template ──────────────────── */

export const TEST_CASE_TEMPLATE_LINES = [
  "Use este modelo para eu validar o caso de teste antes de montar:",
  "",
  "Título:",
  "Objetivo:",
  "Pré-condições:",
  "Passos:",
  "Resultado esperado:",
  "Severidade/Prioridade:",
];
