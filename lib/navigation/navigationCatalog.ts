import { SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";

export type NavModule =
  | "home"
  | "companies"
  | "operations"
  | "quality"
  | "automation"
  | "requests"
  | "agenda"
  | "support"
  | "chat"
  | "brain"
  | "admin"
  | "documents"
  | "users"
  | "management"
  | "logs" | "permissoes";

export type NavPermissionRequirement = {
  moduleId: string;
  action: string;
};

export type NavItemDef = {
  id: string;
  routeId: string;
  label: string;
  iconKey: string;
  module: NavModule;
  href?: string;
  companyRoute?: string;
  children?: NavItemDef[];
  allowedRoles?: SystemRole[];
  onlyRoles?: SystemRole[];
  requiredPermission?: NavPermissionRequirement;
  favoriteEnabled?: boolean;
  action?: "navigate" | "focusSearch" | "openCreateModal";
  testId?: string;
  /** Label de agrupamento visual no sidebar (não afeta filtros de role) */
  group?: string;
};

export type NavModuleDef = {
  id: NavModule;
  routeId?: string;
  label: string;
  iconKey: string;
  href?: string;
  items: NavItemDef[];
  allowedRoles?: SystemRole[];
  requiredPermission?: NavPermissionRequirement;
  testId?: string;
};

// Role groups for cleaner permissions
const SYSTEM_USERS: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
];
const INSTITUTIONAL_USERS: SystemRole[] = [SYSTEM_ROLES.COMPANY_USER, SYSTEM_ROLES.EMPRESA];
const ALL_USERS: SystemRole[] = [...SYSTEM_USERS, ...INSTITUTIONAL_USERS];

const LEADER_AND_SUPPORT: SystemRole[] = [SYSTEM_ROLES.LEADER_TC, SYSTEM_ROLES.TECHNICAL_SUPPORT];
const ALL_INTERNAL: SystemRole[] = SYSTEM_USERS;
const PRIVILEGED: SystemRole[] = LEADER_AND_SUPPORT;
const USER_MANAGERS: SystemRole[] = PRIVILEGED;

export const NAV_CATALOG: NavModuleDef[] = [
  // ============================================
  // HOME — All users
  // ============================================
  {
    id: "home",
    routeId: "home.principal",
    label: "Home",
    iconKey: "home",
    href: "/home",
    allowedRoles: ALL_USERS,
    testId: "nav-home",
    items: [],
  },

  // ============================================
  // EMPRESAS — Only for SYSTEM_USERS
  // ============================================
  {
    id: "companies",
    label: "Gestão de Empresas",
    iconKey: "building",
    allowedRoles: SYSTEM_USERS,
    testId: "nav-companies",
    items: [
      {
        id: "companies-listing",
        routeId: "empresas.listagem",
        label: "Listagem",
        iconKey: "layout",
        module: "companies",
        href: "/admin/clients",
        favoriteEnabled: true,
        testId: "nav-companies-list",
      },
      {
        id: "companies-search",
        routeId: "empresas.buscar",
        label: "Buscar empresa",
        iconKey: "search",
        module: "companies",
        href: "/admin/clients?focus=search",
        action: "focusSearch",
        allowedRoles: PRIVILEGED,
        favoriteEnabled: true,
        testId: "nav-companies-search",
      },
      {
        id: "companies-create",
        routeId: "empresas.criar",
        label: "Criar empresa",
        iconKey: "plus-circle",
        module: "companies",
        href: "/admin/clients?modal=create",
        action: "openCreateModal",
        allowedRoles: PRIVILEGED,
        favoriteEnabled: true,
        testId: "nav-companies-create",
      },
    ],
  },

  // ============================================
  // OPERAÃ‡Ã•ES — All users (context varies)
  // ============================================
  {
    id: "operations",
    label: "Operações",
    iconKey: "monitor",
    allowedRoles: ALL_USERS,
    testId: "nav-operations",
    items: [
      {
        id: "ops-dashboard",
        routeId: "operacao.dashboard",
        label: "Painel operacional",
        iconKey: "compass",
        module: "operations",
        companyRoute: "dashboard",
        href: "/operacoes/dashboard",
        favoriteEnabled: true,
        testId: "nav-operations-dashboard",
      },
      {
        id: "ops-metrics",
        routeId: "operacao.metricas",
        label: "Métricas",
        iconKey: "bar-chart",
        module: "operations",
        href: "/operacoes/metricas",
        favoriteEnabled: true,
        testId: "nav-operations-metrics",
      },
      {
        id: "ops-search",
        routeId: "operacao.busca",
        label: "Buscar",
        iconKey: "search",
        module: "operations",
        href: "/operacoes/buscar",
        allowedRoles: PRIVILEGED,
        favoriteEnabled: true,
        testId: "nav-operations-search",
      },
    ],
  },

  // ============================================
  // REPOSITÃ“RIO DE TESTES — All users
  // Removed: Releases, Cobertura, Evidências
  // ============================================
  {
    id: "quality",
    label: "Repositório de Testes",
    iconKey: "check-circle",
    allowedRoles: ALL_USERS,
    testId: "nav-test-repository",
    items: [
      {
        id: "quality-cases",
        routeId: "testes-manuais.casos",
        label: "Casos de Teste",
        iconKey: "clipboard",
        module: "quality",
        href: "/casos-de-teste",
        favoriteEnabled: true,
        testId: "nav-test-cases",
      },
      {
        id: "quality-plans",
        routeId: "testes-manuais.planos",
        label: "Planos de Teste",
        iconKey: "book",
        module: "quality",
        companyRoute: "planos-de-teste",
        favoriteEnabled: true,
        testId: "nav-test-plans",
      },
      {
        id: "quality-runs",
        routeId: "testes-manuais.runs",
        label: "Runs",
        iconKey: "play",
        module: "quality",
        companyRoute: "runs",
        favoriteEnabled: true,
        testId: "nav-test-runs",
      },
      {
        id: "quality-defects",
        routeId: "testes-manuais.defeitos",
        label: "Defeitos",
        iconKey: "alert-circle",
        module: "quality",
        companyRoute: "defeitos",
        href: "/defeitos",
        favoriteEnabled: true,
        testId: "nav-defects",
      },
    ],
  },

  // ============================================
  // AUTOMAÃ‡ÃƒO — All internal users
  // Grouped: Workspace | Execuções | Ativos
  // ============================================
  {
    id: "automation",
    label: "Automação",
    iconKey: "zap",
    allowedRoles: ALL_INTERNAL,
    testId: "nav-automation",
    items: [
      {
        id: "auto-playwright",
        routeId: "automacao.playwright",
        label: "Playwright",
        iconKey: "zap",
        module: "automation",
        href: "/automacoes/playwright",
        favoriteEnabled: true,
        group: "Workspace",
        testId: "nav-automation-playwright",
      },
      {
        id: "auto-ui-studio",
        routeId: "automacao.studio",
        label: "UI Studio",
        iconKey: "monitor",
        module: "automation",
        href: "/automacoes/ui-studio",
        favoriteEnabled: true,
        group: "Workspace",
        testId: "nav-automation-ui-studio",
      },
      {
        id: "auto-execucoes",
        routeId: "automacao.execucoes",
        label: "Execuções",
        iconKey: "play",
        module: "automation",
        href: "/automacoes/execucoes",
        favoriteEnabled: true,
        group: "Execuções",
        testId: "nav-automation-executions",
      },
      {
        id: "auto-fluxos",
        routeId: "automacao.fluxos",
        label: "Fluxos automatizados",
        iconKey: "git-branch",
        module: "automation",
        href: "/automacoes/fluxos",
        favoriteEnabled: true,
        group: "Execuções",
        testId: "nav-automation-flows",
      },
      {
        id: "auto-casos",
        routeId: "automacao.casos",
        label: "Casos automatizados",
        iconKey: "clipboard",
        module: "automation",
        href: "/automacoes/casos",
        favoriteEnabled: true,
        group: "Execuções",
        testId: "nav-automation-cases",
      },
      {
        id: "auto-scripts",
        routeId: "automacao.scripts",
        label: "Scripts",
        iconKey: "code",
        module: "automation",
        href: "/automacoes/scripts",
        favoriteEnabled: true,
        group: "Ativos",
        testId: "nav-automation-scripts",
      },
      {
        id: "auto-tools",
        routeId: "automacao.ferramentas",
        label: "Ferramentas",
        iconKey: "tool",
        module: "automation",
        href: "/automacoes/tools",
        favoriteEnabled: true,
        group: "Ativos",
        testId: "nav-automation-tools",
      },
      {
        id: "auto-api-lab",
        routeId: "automacao.api-lab",
        label: "API Lab",
        iconKey: "code",
        module: "automation",
        href: "/automacoes/api-lab",
        favoriteEnabled: true,
        group: "Workspace",
        testId: "nav-automation-api-lab",
      },
      {
        id: "auto-base64",
        routeId: "automacao.base64",
        label: "Base64 / Encoders",
        iconKey: "hash",
        module: "automation",
        href: "/automacoes/base64",
        favoriteEnabled: true,
        group: "Workspace",
        testId: "nav-automation-base64",
      },
      {
        id: "auto-arquivos",
        routeId: "automacao.biblioteca",
        label: "Biblioteca",
        iconKey: "folder",
        module: "automation",
        href: "/automacoes/base64?tab=library",
        favoriteEnabled: true,
        group: "Workspace",
        testId: "nav-automation-arquivos",
      },
      {
        id: "auto-logs",
        routeId: "automacao.logs",
        label: "Logs",
        iconKey: "file-text",
        module: "automation",
        href: "/automacoes/logs",
        favoriteEnabled: true,
        group: "Ativos",
        testId: "nav-automation-logs",
      },
    ],
  },

  // ============================================
  // SOLICITAÃ‡Ã•ES — Leader + Technical support only
  // ============================================
  {
    id: "requests",
    routeId: "solicitacoes.listagem",
    label: "Solicitações",
    iconKey: "clipboard",
    href: "/solicitacoes",
    allowedRoles: LEADER_AND_SUPPORT,
    testId: "nav-requests",
    items: [
      {
        id: "requests-list",
        routeId: "solicitacoes.listagem",
        label: "Listagem",
        iconKey: "clipboard",
        module: "requests",
        href: "/solicitacoes",
        favoriteEnabled: true,
        testId: "nav-requests-list",
      },
      {
        id: "requests-search",
        routeId: "solicitacoes.buscar",
        label: "Buscar solicitação",
        iconKey: "search",
        module: "requests",
        href: "/solicitacoes?focus=search",
        action: "focusSearch",
        favoriteEnabled: true,
        testId: "nav-requests-search",
      },
    ],
  },

  // ============================================
  // AGENDA — Leader + Technical support only
  // ============================================
  {
    id: "agenda",
    routeId: "agenda.release",
    requiredPermission: { moduleId: "release_calendar", action: "view" },
    label: "Agenda",
    iconKey: "clock",
    href: "/agenda",
    allowedRoles: LEADER_AND_SUPPORT,
    testId: "nav-agenda",
    items: [],
  },

  // ============================================
  // SUPORTE — All users
  // ============================================
  {
    id: "support",
    label: "Suporte",
    iconKey: "help-circle",
    allowedRoles: ALL_USERS,
    testId: "nav-support",
    items: [
      {
        id: "support-create",
        routeId: "suporte.criar",
        label: "Criar chamado",
        iconKey: "plus-circle",
        module: "support",
        href: "/kanban-it?modal=create",
        action: "openCreateModal",
        favoriteEnabled: true,
        testId: "nav-support-create",
      },
      {
        id: "support-kanban",
        routeId: "suporte.kanban",
        label: "Kanban de chamados",
        iconKey: "kanban",
        module: "support",
        href: "/kanban-it",
        favoriteEnabled: true,
        testId: "nav-support-kanban",
      },
      {
        id: "support-chamados",
        routeId: "suporte.chamados",
        label: "Chamados",
        iconKey: "inbox",
        module: "support",
        href: "/kanban-it",
        allowedRoles: PRIVILEGED,
        favoriteEnabled: true,
        testId: "nav-support-chamados",
      },
      {
        id: "support-meus-chamados",
        routeId: "suporte.meus-chamados",
        label: "Meus chamados",
        iconKey: "bookmark",
        module: "support",
        href: "/meus-chamados",
        favoriteEnabled: true,
        testId: "nav-support-meus-chamados",
      },
    ],
  },

  // ============================================
  // CHAT — All users (contact scope varies by role)
  // ============================================
  {
    id: "chat",
    label: "Chat",
    iconKey: "message-circle",
    allowedRoles: ALL_USERS,
    testId: "nav-chat",
    items: [
      {
        id: "chat-list",
        routeId: "chat.principal",
        label: "Lista de conversas",
        iconKey: "message-square",
        module: "chat",
        href: "/chat",
        favoriteEnabled: true,
        testId: "nav-chat-list",
      },
      {
        id: "chat-search",
        routeId: "chat.buscar",
        label: "Buscar conversa",
        iconKey: "search",
        module: "chat",
        href: "/chat?focus=search",
        action: "focusSearch",
        favoriteEnabled: true,
        testId: "nav-chat-search",
      },
    ],
  },

  // ============================================
  // BRAIN — All users
  // Removed: Assistente da empresa, Brain Admin, Memórias, Contexto atual
  // ============================================
  {
    id: "brain",
    routeId: "brain.grafo",
    label: "Brain",
    iconKey: "cpu",
    href: "/brain",
    allowedRoles: ALL_USERS,
    testId: "nav-brain",
    items: [
      {
        id: "brain-graph",
        routeId: "brain.grafo",
        label: "Grafo",
        iconKey: "cpu",
        module: "brain",
        href: "/brain",
        favoriteEnabled: true,
        testId: "nav-brain-graph",
      },
      {
        id: "brain-ask",
        routeId: "assistente.perguntar",
        label: "Perguntar",
        iconKey: "message-circle",
        module: "brain",
        href: "/brain/perguntar",
        favoriteEnabled: true,
        testId: "nav-brain-ask",
      },
    ],
  },

  // ============================================
  // DOCUMENTOS — All users
  // Removed: Documentos da empresa, Documentação técnica, Evidências, Exportações
  // ============================================
  {
    id: "documents",
    label: "Documentos",
    iconKey: "file-text",
    allowedRoles: ALL_USERS,
    testId: "nav-documents",
    items: [
      {
        id: "docs-central",
        routeId: "documentos.central",
        label: "Central de documentos",
        iconKey: "folder",
        module: "documents",
        href: "/documentos",
        favoriteEnabled: true,
        testId: "nav-documents-central",
      },
      {
        id: "docs-repository",
        routeId: "documentos.repositorio",
        label: "Repositório de documentos",
        iconKey: "book",
        module: "documents",
        href: "/documentos/repositorio",
        favoriteEnabled: true,
        testId: "nav-documents-repository",
      },
    ],
  },

  // ============================================
  // GESTÃƒO — perfil e usuários
  // ============================================
  {
    id: "management",
    label: "Gestão",
    iconKey: "sliders",
    allowedRoles: PRIVILEGED,
    testId: "nav-management",
    items: [
      {
        id: "management-profile",
        routeId: "permissoes.visao-geral",
        label: "Perfil",
        iconKey: "shield",
        module: "management",
        href: "/admin/permissions",
        favoriteEnabled: true,
        testId: "nav-management-profile",
      },
      {
        id: "management-users",
        routeId: "permissoes.matriz",
        label: "Usuários",
        iconKey: "users",
        module: "management",
        href: "/admin/users/permissions",
        allowedRoles: USER_MANAGERS,
        favoriteEnabled: true,
        testId: "nav-management-users",
      },
      {
        id: "users-list-empresas",
        routeId: "usuarios.listagem",
        label: "Usuários de empresas",
        iconKey: "building",
        module: "users",
        href: "/admin/users?tab=company",
        allowedRoles: USER_MANAGERS,
        favoriteEnabled: true,
        group: "Listagem",
        testId: "nav-users-list-companies",
      },
    ],
  },

  // ============================================
  // LOGS — link direto, fora de Admin
  // ============================================
  {
    id: "logs",
    routeId: "configuracoes.auditoria",
    label: "Logs",
    iconKey: "eye",
    href: "/admin/audit-logs",
    allowedRoles: PRIVILEGED,
    testId: "nav-logs",
    items: [],
  },
];




