import { SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";

export type NavModule =
  | "home"
  | "overview"
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
  // VISÃO GERAL — Admin / internal overview
  // ============================================
  {
    id: "overview",
    routeId: "visao-geral.admin",
    label: "Visão Geral",
    iconKey: "bar-chart-2",
    href: "/admin/visao-geral",
    allowedRoles: LEADER_AND_SUPPORT,
    testId: "nav-overview",
    items: [],
  },

  // ============================================
  // EMPRESAS — Leader + Technical support only
  // ============================================
  {
    id: "companies",
    routeId: "empresas.listagem",
    label: "Gestão de Empresas",
    iconKey: "briefcase",
    href: "/admin/clients",
    allowedRoles: LEADER_AND_SUPPORT,
    testId: "nav-companies",
    items: [
      {
        id: "companies-search",
        routeId: "empresas.buscar",
        label: "Buscar empresa",
        iconKey: "search",
        module: "companies",
        href: "/admin/clients?focus=search",
        action: "focusSearch",
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
        favoriteEnabled: true,
        testId: "nav-companies-create",
      },
    ],
  },

  // ============================================
  // OPERAÇÕES — Leader + Support only
  // ============================================
  {
    id: "operations",
    routeId: "operacao.inicio",
    label: "Operações",
    iconKey: "activity",
    href: "/operacoes",
    allowedRoles: ALL_USERS,
    testId: "nav-operations",
    items: [
      {
        id: "operations-dashboard",
        routeId: "operacao.dashboard",
        label: "Painel operacional",
        iconKey: "activity",
        module: "operations",
        href: "/operacoes",
        favoriteEnabled: true,
        group: "Operações",
        testId: "nav-operations-dashboard",
      },
      {
        id: "operations-metrics",
        routeId: "operacao.metricas",
        label: "Métricas",
        iconKey: "bar-chart-2",
        module: "operations",
        href: "/operacoes/metricas",
        favoriteEnabled: true,
        group: "Operações",
        testId: "nav-operations-metrics",
      },
      {
        id: "operations-search",
        routeId: "operacao.busca",
        label: "Buscar",
        iconKey: "search",
        module: "operations",
        href: "/operacoes?focus=search",
        action: "focusSearch",
        favoriteEnabled: true,
        group: "Operações",
        testId: "nav-operations-search",
      },
    ],
  },

  // ============================================
  // QUALIDADE — Company/project scoped QA modules
  // ============================================
  {
    id: "quality",
    label: "Controle de qualidade",
    iconKey: "check-square",
    allowedRoles: ALL_USERS,
    testId: "nav-quality",
    items: [
      {
        id: "quality-cases",
        routeId: "testes-manuais.casos",
        label: "Casos de teste",
        iconKey: "clipboard",
        module: "quality",
        href: "/casos-de-teste",
        favoriteEnabled: true,
        group: "Testes",
        testId: "nav-quality-cases",
      },
      {
        id: "quality-plans",
        routeId: "testes-manuais.planos",
        label: "Planos de teste",
        iconKey: "list",
        module: "quality",
        href: "/planos-de-teste",
        favoriteEnabled: true,
        group: "Testes",
        testId: "nav-quality-plans",
      },
      {
        id: "quality-runs",
        routeId: "execucoes.runs",
        label: "Execuções",
        iconKey: "play-circle",
        module: "quality",
        href: "/runs",
        favoriteEnabled: true,
        group: "Testes",
        testId: "nav-quality-runs",
      },
      {
        id: "quality-defects",
        routeId: "defeitos.lista",
        label: "Defeitos",
        iconKey: "alert-triangle",
        module: "quality",
        href: "/defeitos",
        favoriteEnabled: true,
        group: "Testes",
        testId: "nav-quality-defects",
      },
    ],
  },

  // ============================================
  // AUTOMAÇÃO — Workspace tools
  // ============================================
  {
    id: "automation",
    label: "Automação",
    iconKey: "zap",
    allowedRoles: ALL_INTERNAL,
    testId: "nav-automation",
    items: [
      {
        id: "auto-tools",
        routeId: "automacao.ferramentas",
        label: "Tools",
        iconKey: "tool",
        module: "automation",
        href: "/automacoes/tools",
        favoriteEnabled: true,
        group: "Workspace",
        testId: "nav-automation-tools",
      },
      {
        id: "auto-playwright",
        routeId: "automacao.playwright",
        label: "Playwright",
        iconKey: "play-circle",
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
        iconKey: "layout",
        module: "automation",
        href: "/automacoes/ui-studio",
        favoriteEnabled: true,
        group: "Workspace",
        testId: "nav-automation-ui-studio",
      },
      {
        id: "auto-api-lab",
        routeId: "automacao.api-lab",
        label: "API Lab",
        iconKey: "terminal",
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
        id: "auto-execucoes",
        routeId: "automacao.execucoes",
        label: "Execuções",
        iconKey: "activity",
        module: "automation",
        href: "/automacoes/execucoes",
        favoriteEnabled: true,
        group: "Ativos",
        testId: "nav-automation-execucoes",
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
  // SOLICITAÇÕES — Leader + Technical support only
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
    ],
  },

  // ============================================
  // AGENDA — All users with agenda permission
  // ============================================
  {
    id: "agenda",
    routeId: "agenda.meus-agendamentos",
    requiredPermission: { moduleId: "release_calendar", action: "view" },
    label: "Agenda",
    iconKey: "clock",
    href: "/agenda?view=mine",
    allowedRoles: ALL_USERS,
    testId: "nav-agenda",
    items: [
      {
        id: "agenda-mine",
        routeId: "agenda.meus-agendamentos",
        label: "Meus agendamentos",
        iconKey: "user",
        module: "agenda",
        href: "/agenda?view=mine",
        allowedRoles: ALL_USERS,
        requiredPermission: { moduleId: "release_calendar", action: "view" },
        favoriteEnabled: true,
        testId: "nav-agenda-mine",
      },
      {
        id: "agenda-general",
        routeId: "agenda.agendamentos-gerais",
        label: "Agendamentos gerais",
        iconKey: "users",
        module: "agenda",
        href: "/agenda?view=management",
        allowedRoles: SYSTEM_USERS,
        requiredPermission: { moduleId: "release_calendar", action: "view" },
        favoriteEnabled: true,
        testId: "nav-agenda-general",
      },
    ],
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
    href: "/chat",
    routeId: "chat.principal",
    items: [],
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
  // GESTÃO — Leader + Technical support only
  // ============================================
  {
    id: "management",
    label: "Gestão",
    iconKey: "settings",
    allowedRoles: USER_MANAGERS,
    testId: "nav-management",
    items: [
      {
        id: "management-profile",
        routeId: "gestao.perfil",
        label: "Perfil",
        iconKey: "user-check",
        module: "management",
        href: "/admin/profile",
        favoriteEnabled: true,
        testId: "nav-management-profile",
      },
      {
        id: "management-permissions",
        routeId: "permissoes.perfil",
        label: "Gestão de perfis",
        iconKey: "shield",
        module: "management",
        href: "/admin/permissions",
        allowedRoles: LEADER_AND_SUPPORT,
        requiredPermission: { moduleId: "permissions", action: "view" },
        favoriteEnabled: true,
        testId: "nav-management-permissions",
      },
      {
        id: "management-users",
        routeId: "usuarios.listagem",
        label: "Gestão de usuários",
        iconKey: "users",
        module: "management",
        href: "/admin/users",
        allowedRoles: LEADER_AND_SUPPORT,
        requiredPermission: { moduleId: "users", action: "view" },
        favoriteEnabled: true,
        testId: "nav-management-users",
        children: [
          {
            id: "management-users-list",
            routeId: "usuarios.listagem",
            label: "Listagem de usuários",
            iconKey: "users",
            module: "management",
            href: "/admin/users",
            allowedRoles: LEADER_AND_SUPPORT,
            requiredPermission: { moduleId: "users", action: "view" },
            favoriteEnabled: true,
            testId: "nav-management-users-list",
          },
          {
            id: "management-users-create-tc",
            routeId: "usuarios.criar-usuário-tc",
            label: "Criar Usuários TC",
            iconKey: "user-plus",
            module: "management",
            href: "/admin/users?tab=testing&modal=create&role=testing_company_user",
            action: "openCreateModal",
            allowedRoles: LEADER_AND_SUPPORT,
            requiredPermission: { moduleId: "users", action: "create" },
            favoriteEnabled: true,
            testId: "nav-management-users-create-tc",
          },
          {
            id: "management-users-create-company",
            routeId: "usuarios.criar-usuário-empresa",
            label: "Criar usuário empresarial",
            iconKey: "plus-circle",
            module: "management",
            href: "/admin/users?tab=company&modal=create&role=company_user",
            action: "openCreateModal",
            allowedRoles: LEADER_AND_SUPPORT,
            requiredPermission: { moduleId: "users", action: "create" },
            favoriteEnabled: true,
            testId: "nav-management-users-create-company",
          },
          {
            id: "management-users-create-leader",
            routeId: "usuarios.criar-lider",
            label: "Criar Líder TC",
            iconKey: "plus-circle",
            module: "management",
            href: "/admin/users?tab=admin&modal=create&role=leader_tc",
            action: "openCreateModal",
            allowedRoles: [SYSTEM_ROLES.LEADER_TC],
            requiredPermission: { moduleId: "users", action: "create" },
            favoriteEnabled: true,
            testId: "nav-management-users-create-leader",
          },
          {
            id: "management-users-create-support",
            routeId: "usuarios.criar-suporte",
            label: "Criar administrador",
            iconKey: "tool",
            module: "management",
            href: "/admin/users?tab=support&modal=create&role=technical_support",
            action: "openCreateModal",
            allowedRoles: [SYSTEM_ROLES.LEADER_TC],
            requiredPermission: { moduleId: "users", action: "create" },
            favoriteEnabled: true,
            testId: "nav-management-users-create-support",
          },
        ],
      },
    ],
  },

  {
    id: "logs",
    routeId: "logs.sistema",
    label: "Logs",
    iconKey: "file-text",
    href: "/admin/logs",
    allowedRoles: LEADER_AND_SUPPORT,
    testId: "nav-logs",
    items: [],
  },
];

