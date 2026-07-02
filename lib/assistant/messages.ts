/**
 * User-facing messages and templates for the assistant.
 * Centralised here so UX copy can change without touching business logic.
 */

import type { AssistantToolName } from "./types";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Duplicate / repeat messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const REPEATED_REPLY_MESSAGES: Record<AssistantToolName, string> = {
  get_screen_context:
    "ðŸ“ Acabei de mostrar esse contexto. Quer que eu aprofunde em **permissÃµes**, **chamados** ou **empresa**?",
  list_available_actions:
    "âœ… JÃ¡ listei as aÃ§Ãµes disponÃ­veis. Qual delas vocÃª quer executar?",
  search_internal_records:
    "ðŸ” Acabei de fazer essa busca. Quer refinar por **ID**, **status**, **prioridade** ou **responsÃ¡vel**?",
  summarize_entity:
    "ðŸ“‹ JÃ¡ fiz esse resumo. Posso detalhar algum ponto especÃ­fico ou resumir outra entidade.",
  draft_test_case:
    "ðŸ§ª JÃ¡ gerei um caso de teste com esse contexto. Quer ajustar para **bug**, **melhoria** ou outro cenÃ¡rio?",
  create_test_case:
    "Ja preparei esse caso para criacao. Revise o rascunho ou envie novos dados antes de criar outro.",
  explain_permission:
    "ðŸ” JÃ¡ expliquei esse escopo. Quer comparar com outra tela, perfil ou mÃ³dulo?",
  create_ticket:
    "ðŸŽ« JÃ¡ analisei esse pedido. Me envie **dados novos** ou o **modelo preenchido** para continuar.",
  create_comment:
    "ðŸ’¬ JÃ¡ tratei esse comentÃ¡rio. Quer fazer uma atualizaÃ§Ã£o diferente?",
  suggest_next_step:
    "ðŸ’¡ JÃ¡ sugeri os prÃ³ximos passos. Escolha uma das opÃ§Ãµes ou descreva o que precisa fazer.",
  use_brain:
    "ðŸ§  JÃ¡ usamos o Brain para esse mesmo assunto. Quer que eu aprofunde em impacto, riscos ou prÃ³ximos passos?",
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Clarify / low-signal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const CLARIFY_REPLY = [
  "Quero te ajudar, mas nÃ£o consegui entender completamente sua solicitaÃ§Ã£o.",
  "",
  "**Posso ajudar com:**",
  "â€¢ Resumir o contexto desta tela",
  "â€¢ Explicar seu escopo de acesso",
  "â€¢ Criar um chamado a partir de uma descriÃ§Ã£o",
  "â€¢ Buscar tickets, usuÃ¡rios ou empresas",
  "â€¢ Gerar casos de teste",
  "",
  "Para continuarmos o fluxo, me diga qual dessas opÃ§Ãµes vocÃª quer agora (ou descreva em 1 frase).",
  "",
  "**Dica:** Seja especÃ­fico! Por exemplo:",
  "  - \"buscar tickets de alta prioridade\"",
  "  - \"criar chamado sobre erro no login\"",
  "  - \"explicar por que nÃ£o vejo o mÃ³dulo X\"",
].join("\n");

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Ticket template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const TICKET_TEMPLATE_LINES = [
  "Use este modelo para eu estruturar melhor o chamado:",
  "",
  "TÃ­tulo:",
  "DescriÃ§Ã£o:",
  "Impacto:",
  "Comportamento esperado:",
  "Comportamento atual:",
  "Tipo: bug | tarefa | melhoria",
  "Prioridade: baixa | mÃ©dia | alta",
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Test case template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const TEST_CASE_TEMPLATE_LINES = [
  "Use este modelo para eu validar o caso de teste antes de montar:",
  "",
  "TÃ­tulo:",
  "Objetivo:",
  "PrÃ©-condiÃ§Ãµes:",
  "Passos:",
  "Resultado esperado:",
  "Severidade/Prioridade:",
];

