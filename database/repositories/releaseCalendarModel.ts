import "server-only";

export type ReleaseCalendarEventType =
  | "delivery"
  | "meeting"
  | "discovery"
  | "scope_cut"
  | "dev_freeze"
  | "qa_window"
  | "bug_bash"
  | "uat"
  | "release_candidate"
  | "release"
  | "post_release";

export type ReleaseCalendarStatus = "pending" | "ready" | "planned" | "at_risk" | "blocked" | "done" | "delivered" | "cancelled";
export type ReleaseCalendarCriticality = "critical" | "high" | "normal" | "low";
export type ReleaseCalendarContext = "company" | "project" | "user" | "tc" | "support" | "release" | "delivery";
export type ReleaseCalendarAudienceProfile =
  | "all"
  | "empresa"
  | "company_user"
  | "testing_company_user"
  | "leader_tc"
  | "technical_support"
  | "release_actor"
  | "brain";

export type ReleaseCalendarEvent = {
  id: string;
  title: string;
  type: ReleaseCalendarEventType;
  status: ReleaseCalendarStatus;
  criticality: ReleaseCalendarCriticality;
  context: ReleaseCalendarContext;
  markerLabel: string;
  audienceProfiles: ReleaseCalendarAudienceProfile[];
  companyId: string | null;
  companySlug: string | null;
  companyName: string | null;
  projectId: string | null;
  projectSlug: string | null;
  releaseId: string;
  releaseName: string;
  startAt: string;
  endAt: string;
  ownerId: string | null;
  ownerName: string | null;
  participantNames: string[];
  description: string;
  checklist: string[];
  notificationRules: string[];
  brianRules: string[];
};

export type ReleaseCalendarRule = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
};

export type ReleaseCalendarMetric = {
  id: string;
  label: string;
  formula: string;
  description: string;
};

export const releaseCalendarRules: ReleaseCalendarRule[] = [
  {
    id: "single-release-calendar",
    title: "Calendario unico de entrega",
    description: "Toda entrega precisa aparecer em um calendario operacional por empresa, projeto, usuario responsavel e release.",
    acceptanceCriteria: [
      "Release deve ter data de escopo, freeze, janela de QA, homologacao, entrega e pos-release quando aplicavel.",
      "Agenda deve permitir filtrar por empresa, projeto, status, criticidade, contexto e responsavel.",
      "Lider TC e Administrador enxergam a agenda consolidada sem precisar trocar de empresa manualmente.",
      "Brain deve conseguir responder o que entrega quando, quem esta responsavel e o que esta em risco.",
    ],
  },
  {
    id: "delivery-and-meeting-schedule",
    title: "Agendamento de entrega e reuniao",
    description: "Entrega pode ficar pendente sem data; quando tiver dia e horario, gera notificacao. Reuniao sempre nasce como Meet.",
    acceptanceCriteria: [
      "Entrega sem data fica pending.",
      "Entrega com data pode ficar ready, blocked, cancelled, done ou delivered.",
      "Reuniao usa tipo meeting e registra participantes, dia, horario e regra de Meet.",
      "Alteracao de data, horario, participantes ou status gera evento de notificacao.",
    ],
  },
  {
    id: "leader-support-overview",
    title: "Visao consolidada para Lider TC e Administrador",
    description: "Perfis internos da TC precisam ver marcacoes de empresas, projetos e usuarios em uma camada visual compacta.",
    acceptanceCriteria: [
      "Marcacoes devem informar contexto, responsavel e publico-alvo.",
      "Calendario deve agrupar eventos por dia e esconder excesso com contador de mais marcacoes.",
      "Ao clicar em um dia, a tela exibe as marcacoes daquele dia com detalhes operacionais.",
    ],
  },
  {
    id: "qa-window-before-release",
    title: "Janela de QA antes da entrega",
    description: "Release nao pode ser tratada so como data final; precisa ter janela clara de validacao.",
    acceptanceCriteria: [
      "Todo release planejado deve ter evento qa_window.",
      "QA window deve se conectar a planos, runs, bugs e bloqueios.",
      "Notificacoes devem avisar proximidade e atraso da janela.",
    ],
  },
  {
    id: "release-risk-visible",
    title: "Risco visivel antes do prazo",
    description: "A agenda deve mostrar risco antes de virar atraso.",
    acceptanceCriteria: [
      "Eventos podem ficar at_risk ou blocked.",
      "Dashboard deve contar eventos atrasados, em risco e bloqueados.",
      "Brain deve explicar motivo do risco com base em runs, bugs e conversas.",
    ],
  },
  {
    id: "calendar-notifications",
    title: "Agenda notifica sem perder auditoria",
    description: "Eventos de calendario geram notificacao conforme empresa/perfil/usuario, usando o modelo de notificacoes.",
    acceptanceCriteria: [
      "Evento de agenda gera notificacao mesmo que entrega seja suprimida.",
      "Eventos criticos de release nao devem ser silenciados sem registro.",
      "Brain recebe contexto de prazo, responsavel, publico-alvo e risco.",
    ],
  },
];

export const releaseCalendarMetrics: ReleaseCalendarMetric[] = [
  {
    id: "release-events-by-status",
    label: "Eventos por status",
    formula: "count(calendar_events grouped by status)",
    description: "Mostra pendente, pode ir, em risco, bloqueado, concluido, entregue e cancelado.",
  },
  {
    id: "release-risk-rate",
    label: "Taxa de risco da release",
    formula: "(at_risk + blocked) / total_release_events",
    description: "Ajuda a prever atraso antes da data final.",
  },
  {
    id: "qa-window-coverage",
    label: "Cobertura de janela de QA",
    formula: "releases_with_qa_window / total_releases",
    description: "Mostra se as releases possuem tempo real reservado para teste.",
  },
  {
    id: "release-notification-coverage",
    label: "Cobertura de notificacao",
    formula: "calendar_events_with_notifications / total_calendar_events",
    description: "Mostra se os prazos estao gerando avisos e lembretes.",
  },
  {
    id: "calendar-context-coverage",
    label: "Cobertura por contexto",
    formula: "count(calendar_events grouped by context)",
    description: "Mostra se a agenda esta distribuida entre empresa, projeto, usuario, TC, suporte e entrega.",
  },
];

export const releaseCalendarTemplates: ReleaseCalendarEvent[] = [
  {
    id: "template-scope-cut",
    title: "Corte de escopo da release",
    type: "scope_cut",
    status: "planned",
    criticality: "high",
    context: "project",
    markerLabel: "Escopo",
    audienceProfiles: ["leader_tc", "technical_support", "testing_company_user"],
    companyId: null,
    companySlug: null,
    companyName: null,
    projectId: null,
    projectSlug: null,
    releaseId: "template-release",
    releaseName: "Release modelo",
    startAt: "2026-07-01T09:00:00.000-03:00",
    endAt: "2026-07-01T10:00:00.000-03:00",
    ownerId: null,
    ownerName: "Produto/Tech Lead",
    participantNames: ["QA", "Produto"],
    description: "Fechar o que entra e o que fica fora da release.",
    checklist: ["Lista de tickets fechada", "Critérios de aceite revisados", "Riscos conhecidos registrados"],
    notificationRules: ["Avisar lideres e QA", "Gerar lembrete 24h antes", "Gerar alerta se escopo mudar depois do corte"],
    brianRules: ["Resumir escopo", "Apontar itens sem criterio de aceite", "Lembrar decisoes de conversa"],
  },
  {
    id: "template-qa-window",
    title: "Janela de validação QA",
    type: "qa_window",
    status: "planned",
    criticality: "critical",
    context: "user",
    markerLabel: "QA",
    audienceProfiles: ["leader_tc", "technical_support", "testing_company_user"],
    companyId: null,
    companySlug: null,
    companyName: null,
    projectId: null,
    projectSlug: null,
    releaseId: "template-release",
    releaseName: "Release modelo",
    startAt: "2026-07-02T09:00:00.000-03:00",
    endAt: "2026-07-03T18:00:00.000-03:00",
    ownerId: null,
    ownerName: "QA",
    participantNames: ["QA", "Administrador"],
    description: "Executar aceite, regressao e validacoes criticas antes da entrega.",
    checklist: ["Plano de teste criado", "Runs abertas", "Bugs criticos triados", "Evidencias anexadas"],
    notificationRules: ["Avisar inicio da janela", "Avisar bloqueios", "Avisar fim da janela"],
    brianRules: ["Gerar resumo diario", "Apontar gargalos", "Relacionar bugs e runs"],
  },
  {
    id: "template-release",
    title: "Entrega da release",
    type: "release",
    status: "planned",
    criticality: "critical",
    context: "delivery",
    markerLabel: "Entrega",
    audienceProfiles: ["all"],
    companyId: null,
    companySlug: null,
    companyName: null,
    projectId: null,
    projectSlug: null,
    releaseId: "template-release",
    releaseName: "Release modelo",
    startAt: "2026-07-04T10:00:00.000-03:00",
    endAt: "2026-07-04T12:00:00.000-03:00",
    ownerId: null,
    ownerName: "Release Manager",
    participantNames: ["Lider TC", "Administrador", "Empresa"],
    description: "Publicar a versao e acompanhar a estabilizacao inicial.",
    checklist: ["Go/no-go confirmado", "Plano de rollback revisado", "Comunicacao enviada", "Monitoramento ativo"],
    notificationRules: ["Avisar todos os envolvidos", "Avisar status final", "Avisar incidente pos-release"],
    brianRules: ["Gerar release notes", "Registrar decisoes go/no-go", "Criar memoria pos-release"],
  },
];

export function getReleaseCalendarModel() {
  return {
    generatedAt: new Date().toISOString(),
    rules: releaseCalendarRules,
    metrics: releaseCalendarMetrics,
    templates: releaseCalendarTemplates,
  };
}
