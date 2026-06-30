import "server-only";

export type NotificationChannel = "in_app" | "email" | "push" | "chat" | "brain";
export type NotificationCriticality = "critical" | "high" | "normal" | "low";
export type NotificationAudienceScope = "company" | "project" | "role" | "user" | "global";

export type NotificationWorkflow = {
  id: string;
  eventType: string;
  label: string;
  category: "qa" | "chat" | "brain" | "support" | "security" | "access" | "project" | "automation";
  description: string;
  criticality: NotificationCriticality;
  mandatory: boolean;
  defaultChannels: NotificationChannel[];
  audienceScopes: NotificationAudienceScope[];
  recipientRules: string[];
  preferenceRules: string[];
};

export type NotificationPreferenceLayer = {
  id: string;
  label: string;
  priority: number;
  description: string;
  examples: string[];
};

export type NotificationDeliveryStatus = "generated" | "queued" | "delivered" | "suppressed" | "failed" | "read" | "closed";

export type NotificationImplementationItem = {
  id: string;
  title: string;
  area: "model" | "preferences" | "delivery" | "ui" | "brain" | "metrics";
  priority: "critical" | "high" | "medium";
  acceptanceCriteria: string[];
};

export const notificationPreferenceLayers: NotificationPreferenceLayer[] = [
  {
    id: "workflow-default",
    label: "Padrao do evento",
    priority: 1,
    description: "Define canais e obrigatoriedade do tipo de notificacao.",
    examples: ["Senha/reset e seguranca sao obrigatorios", "Comentario de chamado pode ser configuravel"],
  },
  {
    id: "company-preference",
    label: "Preferencia da empresa",
    priority: 2,
    description: "Empresa pode desativar recebimento de categorias ou canais nao criticos.",
    examples: ["Empresa desativa email para comentarios", "Empresa mantem in-app ativo para defeitos"],
  },
  {
    id: "profile-preference",
    label: "Preferencia do perfil",
    priority: 3,
    description: "Perfis podem receber apenas o que faz sentido para sua operacao.",
    examples: ["Lider recebe runs e defeitos", "Usuario comum recebe apenas atribuicoes e comentarios"],
  },
  {
    id: "user-preference",
    label: "Preferencia do usuario",
    priority: 4,
    description: "Usuario pode desativar canais ou categorias nao obrigatorias.",
    examples: ["Usuario desativa email", "Usuario mantem in-app e chat"],
  },
  {
    id: "mandatory-override",
    label: "Regra obrigatoria",
    priority: 5,
    description: "Eventos criticos ignoram opt-out para garantir seguranca, auditoria e operacao.",
    examples: ["Reset de senha", "Alteracao de permissao", "Bloqueio de acesso"],
  },
];

export const notificationWorkflows: NotificationWorkflow[] = [
  {
    id: "run-created",
    eventType: "RUN_CREATED",
    label: "Run criada",
    category: "qa",
    description: "Avisa responsaveis quando uma execucao nasce a partir de um plano.",
    criticality: "normal",
    mandatory: false,
    defaultChannels: ["in_app", "brain"],
    audienceScopes: ["project", "role", "user"],
    recipientRules: ["Responsavel da run", "Lider do projeto", "Usuarios atribuidos aos run items"],
    preferenceRules: ["Respeita empresa", "Respeita perfil", "Respeita usuario", "Mantem evento gerado mesmo se entrega for suprimida"],
  },
  {
    id: "test-failed",
    eventType: "TEST_FAILED",
    label: "Teste reprovado",
    category: "qa",
    description: "Avisa responsaveis quando um caso falha manualmente, via automacao ou pelo Brian.",
    criticality: "high",
    mandatory: false,
    defaultChannels: ["in_app", "chat", "brain"],
    audienceScopes: ["project", "role", "user"],
    recipientRules: ["Responsavel pelo caso", "Responsavel pela run", "Lider do projeto", "Autor da execucao"],
    preferenceRules: ["Pode suprimir email/push", "In-app recomendado", "Brain sempre recebe contexto operacional"],
  },
  {
    id: "defect-assigned",
    eventType: "DEFECT_ASSIGNED",
    label: "Defeito atribuido",
    category: "support",
    description: "Avisa quando um defeito ou chamado muda de responsavel.",
    criticality: "normal",
    mandatory: false,
    defaultChannels: ["in_app", "email", "brain"],
    audienceScopes: ["company", "role", "user"],
    recipientRules: ["Novo responsavel", "Criador", "Lider quando severidade alta"],
    preferenceRules: ["Empresa pode desativar email", "Usuario pode desativar email", "In-app permanece se categoria ativa"],
  },
  {
    id: "chat-mention",
    eventType: "CHAT_MENTION",
    label: "Mencao em conversa",
    category: "chat",
    description: "Avisa usuario citado em conversa por empresa/projeto.",
    criticality: "normal",
    mandatory: false,
    defaultChannels: ["in_app", "chat", "brain"],
    audienceScopes: ["company", "project", "user"],
    recipientRules: ["Usuario mencionado", "Participantes da conversa quando configurado"],
    preferenceRules: ["Respeita usuario", "Respeita empresa", "Brain recebe candidato de memoria quando a mensagem tiver sinal relevante"],
  },
  {
    id: "brain-memory-candidate",
    eventType: "BRAIN_MEMORY_CANDIDATE",
    label: "Candidato de memoria do Brain",
    category: "brain",
    description: "Avisa que uma conversa, nota ou execucao pode virar memoria auditavel.",
    criticality: "normal",
    mandatory: false,
    defaultChannels: ["in_app", "brain"],
    audienceScopes: ["project", "role", "user"],
    recipientRules: ["Autor", "Lider do projeto", "Usuarios com permissao Brain"],
    preferenceRules: ["Pode ser silenciado por usuario", "Empresa pode silenciar recebimento", "Brain mantem sinal interno"],
  },
  {
    id: "access-updated",
    eventType: "USER_ACCESS_UPDATED",
    label: "Permissao alterada",
    category: "access",
    description: "Avisa alteracao de acesso, perfil, empresa ou permissao.",
    criticality: "critical",
    mandatory: true,
    defaultChannels: ["in_app", "email", "brain"],
    audienceScopes: ["company", "role", "user", "global"],
    recipientRules: ["Usuario afetado", "Admin da empresa", "Lider TC quando perfil global"],
    preferenceRules: ["Nao pode ser desativada", "Empresa nao bloqueia", "Usuario nao bloqueia"],
  },
  {
    id: "password-reset",
    eventType: "PASSWORD_RESET_REQUEST",
    label: "Reset de senha",
    category: "security",
    description: "Avisa solicitacao, aprovacao ou rejeicao de reset de senha.",
    criticality: "critical",
    mandatory: true,
    defaultChannels: ["in_app", "email", "brain"],
    audienceScopes: ["user", "role", "global"],
    recipientRules: ["Usuario solicitante", "Fila de revisao", "Admin/Global conforme regra"],
    preferenceRules: ["Nao pode ser desativada", "Deve manter auditoria", "Entrega critica ignora opt-out"],
  },
];

export const notificationImplementationBacklog: NotificationImplementationItem[] = [
  {
    id: "notification-event-log",
    title: "Separar evento gerado de entrega recebida",
    area: "model",
    priority: "critical",
    acceptanceCriteria: [
      "Todo evento operacional gera registro mesmo se usuario/empresa desativou recebimento.",
      "Registro guarda companyId/companySlug, projectId, actorId, recipients, categoria e fonte.",
      "Dashboard consegue contar eventos gerados e entregas suprimidas.",
    ],
  },
  {
    id: "notification-company-preferences",
    title: "Preferencias de notificacao por empresa",
    area: "preferences",
    priority: "critical",
    acceptanceCriteria: [
      "Empresa pode desativar recebimento de categorias/canais nao criticos.",
      "Eventos criticos ignoram opt-out da empresa.",
      "Tela de empresa mostra o que esta ativo/inativo."],
  },
  {
    id: "notification-profile-preferences",
    title: "Preferencias por perfil e usuario",
    area: "preferences",
    priority: "critical",
    acceptanceCriteria: [
      "Perfil pode ter padrao proprio de recebimento.",
      "Usuario pode sobrescrever preferencias nao criticas.",
      "Regra de prioridade fica documentada e testavel."],
  },
  {
    id: "notification-delivery-decision",
    title: "Resolver decisao de entrega",
    area: "delivery",
    priority: "critical",
    acceptanceCriteria: [
      "Para cada destinatario, calcular delivered ou suppressed.",
      "Salvar motivo da supressao.",
      "Nao criar duplicidade para mesmo dedupeKey."],
  },
  {
    id: "notification-brian-context",
    title: "Brian receber contexto de notificacoes",
    area: "brain",
    priority: "high",
    acceptanceCriteria: [
      "Brian enxerga eventos gerados, entregues e suprimidos.",
      "Brian consegue explicar por que alguem recebeu ou nao recebeu.",
      "Brian pode resumir notificacoes por empresa/projeto/perfil."],
  },
  {
    id: "notification-center-ui",
    title: "Central de notificacoes por empresa",
    area: "ui",
    priority: "high",
    acceptanceCriteria: [
      "Tela mostra catalogo de eventos, preferencias e metricas.",
      "Filtro por empresa, perfil, categoria e canal.",
      "Exibe eventos obrigatorios como bloqueados para opt-out."],
  },
];

export function getNotificationOperationModel() {
  return {
    generatedAt: new Date().toISOString(),
    channels: ["in_app", "email", "push", "chat", "brain"] satisfies NotificationChannel[],
    preferenceLayers: notificationPreferenceLayers,
    workflows: notificationWorkflows,
    backlog: notificationImplementationBacklog,
    rules: [
      "Evento sempre e registrado.",
      "Entrega respeita preferencias quando o evento nao e obrigatorio.",
      "Eventos criticos nao podem ser desativados por empresa, perfil ou usuario.",
      "Brain deve receber contexto operacional mesmo quando a entrega ao usuario for suprimida.",
      "Toda decisao de entrega precisa salvar motivo: delivered, suppressed_by_company, suppressed_by_profile, suppressed_by_user ou mandatory_override.",
    ],
    summary: {
      workflows: notificationWorkflows.length,
      mandatory: notificationWorkflows.filter((item) => item.mandatory).length,
      configurable: notificationWorkflows.filter((item) => !item.mandatory).length,
      channels: 5,
      backlogItems: notificationImplementationBacklog.length,
      criticalBacklog: notificationImplementationBacklog.filter((item) => item.priority === "critical").length,
    },
  };
}
