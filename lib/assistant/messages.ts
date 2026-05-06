/**
 * User-facing messages and templates for the assistant.
 * Centralised here so UX copy can change without touching business logic.
 */

import type { AssistantToolName } from "./types";

/* ──────────────────── Duplicate / repeat messages ──────────────────── */

export const REPEATED_REPLY_MESSAGES: Record<AssistantToolName, string> = {
  get_screen_context:
    "📍 Acabei de mostrar esse contexto. Quer que eu aprofunde em **permissões**, **chamados** ou **empresa**?",
  list_available_actions:
    "✅ Já listei as ações disponíveis. Qual delas você quer executar?",
  search_internal_records:
    "🔍 Acabei de fazer essa busca. Quer refinar por **ID**, **status**, **prioridade** ou **responsável**?",
  summarize_entity:
    "📋 Já fiz esse resumo. Posso detalhar algum ponto específico ou resumir outra entidade.",
  draft_test_case:
    "🧪 Já gerei um caso de teste com esse contexto. Quer ajustar para **bug**, **melhoria** ou outro cenário?",
  explain_permission:
    "🔐 Já expliquei esse escopo. Quer comparar com outra tela, perfil ou módulo?",
  create_ticket:
    "🎫 Já analisei esse pedido. Me envie **dados novos** ou o **modelo preenchido** para continuar.",
  create_comment:
    "💬 Já tratei esse comentário. Quer fazer uma atualização diferente?",
  suggest_next_step:
    "💡 Já sugeri os próximos passos. Escolha uma das opções ou descreva o que precisa fazer.",
};

/* ──────────────────── Clarify / low-signal ──────────────────── */

export const CLARIFY_REPLY = [
  "🤔 Não consegui entender completamente sua solicitação.",
  "",
  "**Posso ajudar com:**",
  "• 📍 Resumir o contexto desta tela",
  "• 🔐 Explicar seu escopo de acesso",
  "• 🎫 Criar um chamado a partir de uma descrição",
  "• 🔍 Buscar tickets, usuários ou empresas",
  "• 🧪 Gerar casos de teste",
  "",
  "💡 **Dica:** Seja específico! Por exemplo:",
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
