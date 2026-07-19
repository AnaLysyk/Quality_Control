export type DomainLayer = "frontend" | "api" | "backend" | "database";

export type DomainCatalogEntry = {
  /** Nome único usado no código, nas buscas e na documentação técnica. */
  id: string;
  label: string;
  description: string;
  locations: Record<DomainLayer, readonly string[]>;
  prismaModels: readonly string[];
  /** Nomes públicos ou legados que apontam para este mesmo domínio. */
  aliases: readonly string[];
};

/**
 * Fonte de verdade para localizar uma funcionalidade de ponta a ponta.
 *
 * As URLs públicas em português são mantidas por compatibilidade. Código novo
 * deve usar o `id` canônico em inglês e reutilizar a implementação indicada
 * aqui, sem criar uma segunda regra de negócio dentro de uma rota legada.
 */
export const DOMAIN_CATALOG = [
  {
    id: "access-requests",
    label: "Solicitações de acesso",
    description: "Solicitação pública, análise, comentários, aprovação e histórico de acesso.",
    locations: {
      frontend: ["app/admin/access-requests", "app/login/access-request", "app/solicitacoes", "app/requests"],
      api: ["app/api/access-requests", "app/api/admin/access-requests", "app/api/requests", "app/api/support/access-request"],
      backend: ["backend/access-requests"],
      database: ["database/repositories/access-requests"],
    },
    prismaModels: ["AccessRequest", "AccessRequestComment", "Request"],
    aliases: ["solicitacoes", "requests", "access-request"],
  },
  {
    id: "applications",
    label: "Aplicações",
    description: "Catálogo de aplicações e sistemas vinculados às empresas.",
    locations: {
      frontend: ["app/applications-hub", "app/applications-panel"],
      api: ["app/api/applications"],
      backend: ["backend/applicationsStore.ts"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["Application"],
    aliases: ["aplicacoes", "sistemas"],
  },
  {
    id: "assistant",
    label: "Assistente",
    description: "Interpretação de intenção e ferramentas conversacionais com autorização.",
    locations: {
      frontend: ["app/components/ChatButton.tsx", "app/components/ChatWorkspace.tsx"],
      api: ["app/api/assistant", "app/api/assistente", "app/api/ai"],
      backend: ["backend/assistant", "backend/ai"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["AssistantAuditLog"],
    aliases: ["assistente", "ai"],
  },
  {
    id: "audit",
    label: "Auditoria",
    description: "Rastreabilidade de ações administrativas e alterações sensíveis.",
    locations: {
      frontend: ["app/admin/audit-logs", "app/audit-logs"],
      api: ["app/api/admin/audit-logs"],
      backend: ["backend/audit", "backend/assistantAuditLog.ts"],
      database: ["database/repositories/auditLogRepository.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["AuditLog", "AssistantAuditLog", "BrainAuditLog"],
    aliases: ["audit-logs", "historico"],
  },
  {
    id: "automations",
    label: "Automações",
    description: "Catálogo, estúdio, execução Playwright e ativos de automação.",
    locations: {
      frontend: ["app/automacoes"],
      api: ["app/api/automations", "app/api/playwright"],
      backend: ["backend/automations", "backend/playwright"],
      database: ["database/repositories/automationCatalog.ts", "database/repositories/automationStudio.ts", "database/repositories/automationIde.ts"],
    },
    prismaModels: ["AutomationDocument", "AutomationDocumentFragment", "AutomationAssetUsage"],
    aliases: ["automacoes", "playwright"],
  },
  {
    id: "brain",
    label: "Brain",
    description: "Grafo contextual, memória, fontes, agentes, governança e sincronização.",
    locations: {
      frontend: ["app/brain", "app/admin/brain"],
      api: ["app/api/brain", "app/api/admin/brain"],
      backend: ["backend/brain"],
      database: ["database/repositories/brainQaRegistry.ts", "database/repositories/brainEmailFlowRepository.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["BrainNode", "BrainEdge", "BrainMemory", "BrainWorkspace", "BrainSourceConfig", "BrainBehaviorProfile"],
    aliases: ["brian", "cerebro", "grafo"],
  },
  {
    id: "chat",
    label: "Chat e conversas",
    description: "Mensagens, contatos, presença, agenda e conversas unificadas.",
    locations: {
      frontend: ["app/chat", "app/conversas"],
      api: ["app/api/chat", "app/api/comments"],
      backend: ["backend/chatStore.ts", "backend/chatContacts.ts", "backend/conversationBrainFeed.ts"],
      database: ["database/repositories/unifiedConversationModel.ts"],
    },
    prismaModels: [],
    aliases: ["conversas", "messages"],
  },
  {
    id: "companies",
    label: "Empresas",
    description: "Cadastro, perfil, integrações, visibilidade e contexto de empresa.",
    locations: {
      frontend: ["app/clients", "app/admin/clients", "app/empresas"],
      api: ["app/api/clients", "app/api/companies", "app/api/company", "app/api/empresas"],
      backend: ["backend/companyRecord.ts", "backend/companyRoutes.ts", "backend/companyVisibility.ts", "backend/company-lookup"],
      database: ["database/repositories/clientsRepository.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["Company", "CompanyIntegration", "UserCompany", "UserCompanyLink"],
    aliases: ["empresas", "clients", "clientes", "company"],
  },
  {
    id: "dashboard",
    label: "Dashboards",
    description: "Indicadores, resumos executivos e visão operacional contextual.",
    locations: {
      frontend: ["app/dashboard", "app/home", "app/admin/home", "app/metrics", "app/operacoes"],
      api: ["app/api/dashboard", "app/api/metrics", "app/api/operacao"],
      backend: ["backend/dashboard", "backend/healthScore.ts", "backend/mttr.ts"],
      database: ["database/repositories/qaOperationModel.ts", "database/repositories/runOperationModel.ts"],
    },
    prismaModels: ["QualityGoalStatus", "QualityGoalAlert", "QualityGateHistory"],
    aliases: ["painel", "metricas", "visao-geral", "operacao"],
  },
  {
    id: "defects",
    label: "Defeitos",
    description: "Registro, atividade, histórico e quadros de defeitos.",
    locations: {
      frontend: ["app/defeitos", "app/issues", "app/kanban-it"],
      api: ["app/api/company-defects", "app/api/defect", "app/api/kanban", "app/api/admin/defeitos"],
      backend: ["backend/companyDefects.ts", "backend/companyDefectsAccess.ts", "backend/defectActivity.ts"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["Defect", "DefectHistoryEvent", "KanbanCard"],
    aliases: ["defeitos", "issues", "bugs", "kanban"],
  },
  {
    id: "documents",
    label: "Documentos",
    description: "Documentos de empresa, wiki e documentação oficial da plataforma.",
    locations: {
      frontend: ["app/documentos", "app/documentacao", "app/docs"],
      api: ["app/api/company-docs", "app/api/company-documents", "app/api/platform-docs"],
      backend: ["backend/documentation", "backend/companyWikiAccess.ts", "backend/wikiDocsStatus.ts"],
      database: ["database/repositories/platformDocsStore.ts", "database/repositories/documentation.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["CompanyDocument", "DocumentHistoryEvent", "WikiCategory", "WikiDoc"],
    aliases: ["documentos", "docs", "wiki", "documentacao"],
  },
  {
    id: "integrations",
    label: "Integrações",
    description: "Qase, Jira, GitHub, S3 e serviços externos.",
    locations: {
      frontend: ["app/integrations"],
      api: ["app/api/admin/integrations", "app/api/admin/qase", "app/api/s3", "app/api/brasilapi"],
      backend: ["backend/integrations.ts", "backend/qaseSdk.ts", "backend/jiraCloud.ts", "backend/github"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["CompanyIntegration", "GithubAccountLink"],
    aliases: ["integracoes", "qase", "jira", "github", "s3"],
  },
  {
    id: "navigation",
    label: "Navegação e mapa",
    description: "Catálogo de telas, menu, rotas e governança do mapa do sistema.",
    locations: {
      frontend: ["app/admin/sistema/mapa", "app/components/navigation"],
      api: ["app/api/favorites"],
      backend: ["backend/navigation"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["Favorite"],
    aliases: ["menu", "mapa", "routes", "favorites"],
  },
  {
    id: "notifications",
    label: "Notificações",
    description: "Eventos, preferências, entrega e leitura de notificações.",
    locations: {
      frontend: ["app/notificacoes"],
      api: ["app/api/notifications", "app/api/notification-catalog", "app/api/notification-model"],
      backend: ["backend/notifications", "backend/notificationService.ts", "backend/notificationPreferencesStore.ts", "backend/notificationEventsStore.ts"],
      database: ["database/repositories/notificationOperationModel.ts", "database/repositories/notificationWorkflowExtensions.ts"],
    },
    prismaModels: ["UserNotification"],
    aliases: ["notificacoes", "alerts", "avisos"],
  },
  {
    id: "permissions",
    label: "Permissões e vínculos",
    description: "Perfis, capacidades, escopo de empresa/projeto e exceções por usuário.",
    locations: {
      frontend: ["app/admin/permissions", "app/admin/users/permissions", "app/usuarios/vinculos"],
      api: ["app/api/admin/modules", "app/api/admin/profile-permissions", "app/api/admin/user-permissions", "app/api/usuarios/vinculos"],
      backend: ["backend/permissions", "backend/rbac", "backend/store/permissionsStore.ts", "backend/userScopePolicy.ts"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["Membership", "ProjectTeamAssignment", "UserCompanyLink", "UserPermissionOverride"],
    aliases: ["permissoes", "rbac", "vinculos", "roles", "profiles"],
  },
  {
    id: "projects",
    label: "Projetos",
    description: "Projetos de empresa, responsáveis e escopo operacional.",
    locations: {
      frontend: ["app/empresas"],
      api: ["app/api/projects", "app/api/test-projects"],
      backend: ["backend/projects", "backend/test-projects"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["Project", "ProjectTeamAssignment", "SupportProject"],
    aliases: ["projetos", "test-projects"],
  },
  {
    id: "quality",
    label: "Qualidade",
    description: "Modelo operacional, metas, alertas, gates e visão central de qualidade.",
    locations: {
      frontend: ["app/central-de-qualidade", "app/modelo-qualidade", "app/operacao-qa"],
      api: ["app/api/quality", "app/api/quality-goals", "app/api/admin/quality"],
      backend: ["backend/quality.ts", "backend/qualityAlert.ts", "backend/qualityGateHistory.ts"],
      database: ["database/repositories/quality_goal_status.json", "database/repositories/qaOperationModel.ts"],
    },
    prismaModels: ["QualityAlert", "QualityGateHistory", "QualityGoalStatus", "QualityGoalAlert"],
    aliases: ["qualidade", "qa", "quality-control"],
  },
  {
    id: "releases",
    label: "Releases e agenda",
    description: "Planejamento, calendário, linha do tempo e releases manuais.",
    locations: {
      frontend: ["app/release", "app/agenda", "app/painel-releases-manuais"],
      api: ["app/api/releases", "app/api/releases-manual", "app/api/release-manual", "app/api/release-calendar"],
      backend: ["backend/releaseCalendarStore.ts", "backend/releaseTimeline.ts", "backend/manualReleaseStore.ts"],
      database: ["database/repositories/releaseCalendarModel.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["Release", "ReleaseCase", "ReleaseManual"],
    aliases: ["agenda", "calendario", "entregas", "release-manual"],
  },
  {
    id: "test-cases",
    label: "Casos de teste",
    description: "Repositório, importação, versões e automações vinculadas a casos.",
    locations: {
      frontend: ["app/casos-de-teste"],
      api: ["app/api/test-cases", "app/api/v1/cases"],
      backend: ["backend/test-cases"],
      database: ["database/repositories/automationCases.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["StoredTestCase", "TestCaseAssetLink"],
    aliases: ["casos-de-teste", "cases", "repositorio"],
  },
  {
    id: "test-data",
    label: "Dados de teste",
    description: "Ativos, pacotes, políticas e resolução segura de dados de teste.",
    locations: {
      frontend: ["app/automacoes"],
      api: ["app/api/test-data-assets", "app/api/test-data-packs"],
      backend: ["backend/test-data-hub"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["TestDataAsset", "TestDataAssetUsagePolicy", "TestDataPack", "TestDataPackItem"],
    aliases: ["massa-de-teste", "test-data-hub", "assets"],
  },
  {
    id: "test-plans",
    label: "Planos de teste",
    description: "Planos, itens, entregas e composição de casos.",
    locations: {
      frontend: ["app/planos-de-teste", "app/empresas"],
      api: ["app/api/test-plans"],
      backend: ["backend/testPlansStore.ts", "backend/testPlanCases.ts"],
      database: ["database/repositories/manual-test-plans.json", "database/prisma/schema.prisma"],
    },
    prismaModels: ["TestPlan", "TestPlanItem", "ManualTestPlan"],
    aliases: ["planos-de-teste", "plans"],
  },
  {
    id: "test-runs",
    label: "Execuções de teste",
    description: "Runs, resultados, evidências, operação e sincronização externa.",
    locations: {
      frontend: ["app/runs", "app/empresas"],
      api: ["app/api/test-runs", "app/api/runs", "app/api/quality/runs", "app/api/v1/runs", "app/api/v1/results"],
      backend: ["backend/runOperationStore.ts", "backend/runDetailViewModel.ts", "backend/qaseRuns.ts"],
      database: ["database/repositories/runOperationModel.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["TestRun", "TestRunResult", "ExecutionAssetUsage"],
    aliases: ["execucoes", "runs", "results"],
  },
  {
    id: "tickets",
    label: "Chamados e suporte",
    description: "Abertura, comentários, eventos, status e atendimento de chamados.",
    locations: {
      frontend: ["app/chamados", "app/meus-chamados", "app/suporte", "app/kanban-it"],
      api: ["app/api/tickets", "app/api/chamados", "app/api/suportes", "app/api/admin/tickets"],
      backend: ["backend/ticketsStore.ts", "backend/ticketCommentsStore.ts", "backend/rbac/tickets.ts", "backend/supportAccess.ts"],
      database: ["database/prisma/schema.prisma"],
    },
    prismaModels: ["Ticket", "TicketComment", "TicketEvent", "TicketReaction", "SupportRequest"],
    aliases: ["chamados", "suporte", "support"],
  },
  {
    id: "users",
    label: "Usuários e identidade",
    description: "Cadastro, autenticação, perfil, sessão e vínculo principal do usuário.",
    locations: {
      frontend: ["app/admin/users", "app/usuarios", "app/profile", "app/me", "app/settings"],
      api: ["app/api/users", "app/api/user", "app/api/usuarios", "app/api/me", "app/api/profile", "app/api/auth"],
      backend: ["backend/auth", "backend/profile", "backend/adminUsers.ts", "backend/userProfileData.ts"],
      database: ["database/repositories/usersStore.ts", "database/prisma/schema.prisma"],
    },
    prismaModels: ["User", "Membership", "UserCompanyLink", "UserPermissionOverride"],
    aliases: ["usuarios", "user", "identity", "perfil"],
  },
] as const satisfies readonly DomainCatalogEntry[];

export function getDomainCatalogEntry(id: string) {
  return DOMAIN_CATALOG.find((domain) => domain.id === id) ?? null;
}
