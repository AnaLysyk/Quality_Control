/**
 * User-facing messages and templates for the assistant.
 * Centralised here so UX copy can change without touching business logic.
 */

import type { AssistantToolName } from "./types";

/* ──────────────────── Duplicate / repeat messages ──────────────────── */

export const REPEATED_REPLY_MESSAGES: Record<AssistantToolName, string> = {
  get_screen_context:
    "Acabei de mostrar esse contexto nesta conversa. Se quiser, posso aprofundar em permissao, chamados ou empresa atual.",
  list_available_actions:
    "Ja listei as acoes disponiveis agora ha pouco. Se quiser, posso executar uma delas com base no seu contexto atual.",
  search_internal_records:
    "Acabei de rodar essa busca. Se quiser, refine por ID, status, prioridade, usuario ou empresa.",
  summarize_entity:
    "Ja fiz esse resumo agora ha pouco. Se quiser, posso detalhar um ponto especifico ou resumir outra entidade.",
  draft_test_case:
    "Ja gerei um caso de teste com esse contexto recente. Se quiser, posso refinar para bug, melhoria ou fluxo especifico.",
  explain_permission:
    "Ja expliquei esse escopo nesta conversa. Se quiser, posso comparar com outra tela, perfil ou modulo.",
  create_ticket:
    "Ja analisei esse pedido de criacao recentemente. Se quiser, me envie dados novos ou um modelo preenchido.",
  create_comment:
    "Ja tratei esse comentario recentemente. Se quiser, posso montar uma atualizacao diferente.",
  suggest_next_step:
    "Ja sugeri o proximo passo nesta conversa. Se quiser, eu sigo direto para a proxima acao util.",
};

/* ──────────────────── Clarify / low-signal ──────────────────── */

export const CLARIFY_REPLY = [
  "Nao consegui interpretar esse texto como uma acao valida nesta tela.",
  "",
  "Se quiser, posso ajudar de forma objetiva com algo como:",
  "- resumir esta tela",
  "- explicar meu escopo de acesso",
  "- transformar um relato real em chamado",
  "- buscar um chamado por ID",
].join("\n");

/* ──────────────────── Ticket template ──────────────────── */

export const TICKET_TEMPLATE_LINES = [
  "Use este modelo para eu estruturar melhor o chamado:",
  "",
  "Titulo:",
  "Descricao:",
  "Impacto:",
  "Comportamento esperado:",
  "Comportamento atual:",
  "Tipo: bug | tarefa | melhoria",
  "Prioridade: baixa | media | alta",
];

/* ──────────────────── Test case template ──────────────────── */

export const TEST_CASE_TEMPLATE_LINES = [
  "Use este modelo para eu validar o caso de teste antes de montar:",
  "",
  "Titulo:",
  "Objetivo:",
  "Pre-condicoes:",
  "Passos:",
  "Resultado esperado:",
  "Severidade/Prioridade:",
];
