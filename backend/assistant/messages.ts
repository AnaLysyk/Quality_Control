/**
 * User-facing messages and templates for the assistant.
 * Centralised here so UX copy can change without touching business logic.
 */

import type { AssistantToolName } from "./types";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Duplicate / repeat messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const REPEATED_REPLY_MESSAGES: Record<AssistantToolName, string> = {
  get_screen_context:
    "ðŸ“ Acabei de mostrar esse contexto. Quer que eu aprofunde em **permissões**, **chamados** ou **empresa**?",
  list_available_actions:
    "âœ… Já listei as ações disponíveis. Qual delas você quer executar?",
  search_internal_records:
    "ðŸ” Acabei de fazer essa busca. Quer refinar por **ID**, **status**, **prioridade** ou **responsável**?",
  summarize_entity:
    "ðŸ“‹ Já fiz esse resumo. Posso detalhar algum ponto específico ou resumir outra entidade.",
  draft_test_case:
    "ðŸ§ª Já gerei um caso de teste com esse contexto. Quer ajustar para **bug**, **melhoria** ou outro cenário?",
  create_test_case:
    "Ja preparei esse caso para criacao. Revise o rascunho ou envie novos dados antes de criar outro.",
  explain_permission:
    "ðŸ” Já expliquei esse escopo. Quer comparar com outra tela, perfil ou módulo?",
  create_ticket:
    "ðŸŽ« Já analisei esse pedido. Me envie **dados novos** ou o **modelo preenchido** para continuar.",
  create_comment:
    "ðŸ’¬ Já tratei esse comentário. Quer fazer uma atualização diferente?",
  suggest_next_step:
    "ðŸ’¡ Já sugeri os próximos passos. Escolha uma das opções ou descreva o que precisa fazer.",
  use_brain:
    "ðŸ§  Já usamos o Brain para esse mesmo assunto. Quer que eu aprofunde em impacto, riscos ou próximos passos?",
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Clarify / low-signal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const CLARIFY_REPLY = [
  "Quero te ajudar, mas não consegui entender completamente sua solicitação.",
  "",
  "**Posso ajudar com:**",
  "• Resumir o contexto desta tela",
  "• Explicar seu escopo de acesso",
  "• Criar um chamado a partir de uma descrição",
  "• Buscar tickets, usuários ou empresas",
  "• Gerar casos de teste",
  "",
  "Para continuarmos o fluxo, me diga qual dessas opções você quer agora (ou descreva em 1 frase).",
  "",
  "**Dica:** Seja específico! Por exemplo:",
  "  - \"buscar tickets de alta prioridade\"",
  "  - \"criar chamado sobre erro no login\"",
  "  - \"explicar por que não vejo o módulo X\"",
].join("\n");

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Ticket template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Test case template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

