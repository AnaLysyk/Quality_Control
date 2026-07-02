import "server-only";

export type ConversationScopeKind = "global" | "company" | "project" | "direct" | "support";
export type ConversationMemoryStatus = "candidate" | "approved" | "ignored";

export type UnifiedConversationRule = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  acceptanceCriteria: string[];
};

export type UnifiedConversationMetric = {
  id: string;
  label: string;
  description: string;
  formula: string;
  source: string[];
};

export type UnifiedConversationBrainAction = {
  id: string;
  label: string;
  userCommand: string;
  requiredContext: string[];
  expectedResult: string[];
};

export const unifiedConversationRules: UnifiedConversationRule[] = [
  {
    id: "single-entrypoint",
    title: "Um unico lugar para conversar",
    description: "Todas as conversas da plataforma devem abrir pelo mesmo hub, independente de empresa, projeto ou perfil.",
    required: true,
    acceptanceCriteria: [
      "A rota /conversas deve ser o hub oficial.",
      "A rota /chat pode continuar como experiencia direta, mas deve usar a mesma origem de dados.",
      "Nenhum modulo deve criar chat paralelo sem registrar no mesmo store.",
    ],
  },
  {
    id: "profile-aware-visibility",
    title: "Visibilidade por perfil",
    description: "Perfis globais veem tudo; perfis de empresa veem somente empresas vinculadas; usuarios comuns veem escopo permitido.",
    required: true,
    acceptanceCriteria: [
      "Leader TC, suporte tecnico e admin veem todos os contatos.",
      "Usuario de empresa ve apenas usuarios da empresa vinculada.",
      "Usuario TC respeita empresa/projeto ativo quando aplicavel.",
    ],
  },
  {
    id: "company-project-context",
    title: "Contexto de empresa e projeto",
    description: "Toda mensagem deve carregar contexto operacional para alimentar Brain, metricas e historico.",
    required: true,
    acceptanceCriteria: [
      "Mensagem deve registrar companyId/companySlug quando disponivel.",
      "Mensagem deve aceitar projectId/projectSlug quando a conversa vier de projeto.",
      "Thread deve permitir filtrar por empresa, projeto, participante e perfil.",
    ],
  },
  {
    id: "brain-memory-feed",
    title: "Conversas alimentam Brain",
    description: "Mensagens relevantes devem virar candidatos de memoria do Brain com origem, autor, escopo e motivo.",
    required: true,
    acceptanceCriteria: [
      "Mensagem enviada registra sinal de conversa para o Brain.",
      "Sinal deve ter status candidate antes de virar memoria oficial.",
      "Brain deve lembrar conversas por empresa, projeto, usuario, perfil e entidade citada.",
    ],
  },
  {
    id: "auditable-conversation-action",
    title: "Acoes auditaveis",
    description: "Quando uma conversa virar caso, defeito, nota, plano ou run, o sistema precisa guardar origem.",
    required: true,
    acceptanceCriteria: [
      "Toda conversao deve registrar sourceType=conversation e sourceId.",
      "Brian precisa informar de qual conversa veio a memoria ou acao.",
      "Usuario precisa conseguir ignorar ou aprovar candidato de memoria.",
    ],
  },
];

export const unifiedConversationMetrics: UnifiedConversationMetric[] = [
  {
    id: "conversation-total-by-company",
    label: "Conversas por empresa",
    description: "Quantidade de threads e mensagens agrupadas por empresa.",
    formula: "count(conversation_threads/messages grouped by companyId)",
    source: ["chat_messages", "chat_threads", "company_context"],
  },
  {
    id: "conversation-memory-candidates",
    label: "Candidatos de memoria",
    description: "Mensagens que podem virar memoria do Brain.",
    formula: "count(conversation_brain_signals where status = candidate)",
    source: ["conversation_brain_signals", "brain_memories"],
  },
  {
    id: "conversation-to-action-rate",
    label: "Conversas convertidas em acao",
    description: "Percentual de conversas que viraram nota, caso, defeito, plano, run ou memoria.",
    formula: "converted_conversation_signals / total_conversation_signals",
    source: ["conversation_brain_signals", "notes", "defects", "test_cases", "runs"],
  },
  {
    id: "conversation-participation-by-profile",
    label: "Participacao por perfil",
    description: "Volume de mensagens por perfil e escopo operacional.",
    formula: "count(messages grouped by profileKind and companyId)",
    source: ["chat_messages", "users", "permissions"],
  },
];

export const unifiedConversationBrainActions: UnifiedConversationBrainAction[] = [
  {
    id: "remember-conversation",
    label: "Lembrar conversa",
    userCommand: "Brian, lembra dessa conversa como regra do projeto.",
    requiredContext: ["threadKey", "messageId", "companyId/companySlug", "actorId"],
    expectedResult: ["Criar candidato de memoria", "Classificar tipo da memoria", "Manter link para conversa de origem"],
  },
  {
    id: "summarize-company-conversations",
    label: "Resumir conversas da empresa",
    userCommand: "Brian, resume o que foi combinado nas conversas dessa empresa.",
    requiredContext: ["companyId/companySlug", "period", "actorId"],
    expectedResult: ["Listar decisoes", "Listar pendencias", "Separar fato de inferencia", "Apontar conversas fonte"],
  },
  {
    id: "conversation-to-ticket",
    label: "Converter conversa em chamado/defeito",
    userCommand: "Brian, transforma essa conversa em chamado.",
    requiredContext: ["threadKey", "messageId", "companyId", "actorId"],
    expectedResult: ["Gerar titulo", "Gerar descricao", "Vincular conversa como origem", "Sugerir prioridade"],
  },
  {
    id: "conversation-to-test-case",
    label: "Converter conversa em caso de teste",
    userCommand: "Brian, cria um caso de teste a partir desse combinado.",
    requiredContext: ["threadKey", "messageId", "projectId", "actorId"],
    expectedResult: ["Gerar pre-condicao", "Gerar passos", "Gerar esperado", "Vincular ao repositorio do projeto"],
  },
];

export function getUnifiedConversationModel() {
  return {
    generatedAt: new Date().toISOString(),
    rules: unifiedConversationRules,
    metrics: unifiedConversationMetrics,
    brianActions: unifiedConversationBrainActions,
    summary: {
      rules: unifiedConversationRules.length,
      requiredRules: unifiedConversationRules.filter((rule) => rule.required).length,
      metrics: unifiedConversationMetrics.length,
      brianActions: unifiedConversationBrainActions.length,
    },
  };
}

