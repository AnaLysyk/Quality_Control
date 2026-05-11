import { SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";

export type NavModule =
  | "home"
  | "companies"
  | "operations"
  | "quality"
  | "automation"
  | "requests"
  | "support"
  | "chat"
  | "brain"
  | "admin"
  | "documents"
  | "users";

export type NavItemDef = {
  id: string;
  label: string;
  iconKey: string;
  module: NavModule;
  href?: string;
  companyRoute?: string;
  children?: NavItemDef[];
  allowedRoles?: SystemRole[];
  onlyRoles?: SystemRole[];
  favoriteEnabled?: boolean;
  action?: "navigate" | "focusSearch" | "openCreateModal";
  testId?: string;
};

export type NavModuleDef = {
  id: NavModule;
  label: string;
  iconKey: string;
  href?: string;
  items: NavItemDef[];
  allowedRoles?: SystemRole[];
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

const LEADER_TC: SystemRole[] = [SYSTEM_ROLES.LEADER_TC];
const LEADER_AND_SUPPORT: SystemRole[] = [SYSTEM_ROLES.LEADER_TC, SYSTEM_ROLES.TECHNICAL_SUPPORT];
const ALL_INTERNAL: SystemRole[] = SYSTEM_USERS;
const PRIVILEGED: SystemRole[] = LEADER_AND_SUPPORT;
const LEADER_ONLY: SystemRole[] = LEADER_TC;

export const NAV_CATALOG: NavModuleDef[] = [
  // ============================================
  // HOME — All users
  // ============================================
  {
    id: "home",
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
    label: "Empresas",
    iconKey: "building",
    allowedRoles: SYSTEM_USERS,
    testId: "nav-companies",
    items: [
      { 
        id: "companies-listing", 
        label: "Listagem", 
        iconKey: "layout", 
        module: "companies", 
        href: "/empresas", 
        favoriteEnabled: true,
        testId: "nav-companies-list",
      },
      { 
        id: "companies-search", 
        label: "Buscar empresa", 
        iconKey: "search", 
        module: "companies", 
        href: "/empresas?focus=search", 
        action: "focusSearch",
        favoriteEnabled: true,
        testId: "nav-companies-search",
      },
      { 
        id: "companies-create", 
        label: "Criar empresa", 
        iconKey: "plus-circle", 
        module: "companies", 
        href: "/empresas?modal=create", 
        action: "openCreateModal",
        allowedRoles: PRIVILEGED, 
        favoriteEnabled: true,
        testId: "nav-companies-create",
      },
    ],
  },

  // ============================================
  // OPERAÇÕES — All users (context varies)
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
        label: "Dashboard", 
        iconKey: "compass", 
        module: "operations", 
        companyRoute: "dashboard", 
        href: "/operacoes/dashboard",
        favoriteEnabled: true,
        testId: "nav-operations-dashboard",
      },
      { 
        id: "ops-metrics", 
        label: "Métricas", 
        iconKey: "bar-chart", 
        module: "operations", 
        href: "/operacoes/metricas",
        favoriteEnabled: true,
        testId: "nav-operations-metrics",
      },
      { 
        id: "ops-search", 
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
  // REPOSITÓRIO DE TESTES — All users
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
        label: "Casos de Teste", 
        iconKey: "clipboard", 
        module: "quality", 
        href: "/casos-de-teste",
        favoriteEnabled: true,
        testId: "nav-test-cases",
      },
      { 
        id: "quality-plans", 
        label: "Planos de Teste", 
        iconKey: "book", 
        module: "quality", 
        companyRoute: "planos-de-teste",
        favoriteEnabled: true,
        testId: "nav-test-plans",
      },
      { 
        id: "quality-runs", 
        label: "Runs", 
        iconKey: "play", 
        module: "quality", 
        companyRoute: "runs",
        favoriteEnabled: true,
        testId: "nav-test-runs",
      },
      { 
        id: "quality-defects", 
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
  // AUTOMAÇÃO — All internal users
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
        label: "Playwright", 
        iconKey: "zap", 
        module: "automation", 
        href: "/automacoes/playwright", 
        favoriteEnabled: true,
        testId: "nav-automation-playwright",
      },
      { 
        id: "auto-ui-studio", 
        label: "UI Studio", 
        iconKey: "monitor", 
        module: "automation", 
        href: "/automacoes/ui-studio",
        favoriteEnabled: true,
        testId: "nav-automation-ui-studio",
      },
      { 
        id: "auto-execucoes", 
        label: "Execuções", 
        iconKey: "play", 
        module: "automation", 
        href: "/automacoes/execucoes",
        favoriteEnabled: true,
        testId: "nav-automation-executions",
      },
      { 
        id: "auto-fluxos", 
        label: "Fluxos automatizados", 
        iconKey: "git-branch", 
        module: "automation", 
        href: "/automacoes/fluxos",
        favoriteEnabled: true,
        testId: "nav-automation-flows",
      },
      { 
        id: "auto-casos", 
        label: "Casos automatizados", 
        iconKey: "clipboard", 
        module: "automation", 
        href: "/automacoes/casos",
        favoriteEnabled: true,
        testId: "nav-automation-cases",
      },
      { 
        id: "auto-scripts", 
        label: "Scripts", 
        iconKey: "code", 
        module: "automation", 
        href: "/automacoes/scripts",
        favoriteEnabled: true,
        testId: "nav-automation-scripts",
      },
      { 
        id: "auto-tools", 
        label: "Ferramentas", 
        iconKey: "tool", 
        module: "automation", 
        href: "/automacoes/ferramentas",
        favoriteEnabled: true,
        testId: "nav-automation-tools",
      },
      { 
        id: "auto-logs", 
        label: "Logs", 
        iconKey: "file-text", 
        module: "automation", 
        href: "/automacoes/logs",
        favoriteEnabled: true,
        testId: "nav-automation-logs",
      },
    ],
  },

  // ============================================
  // SOLICITAÇÕES — Leader + Technical support only
  // ============================================
  {
    id: "requests",
    label: "Solicitações",
    iconKey: "clipboard",
    allowedRoles: LEADER_AND_SUPPORT,
    testId: "nav-requests",
    items: [
      {
        id: "requests-list",
        label: "Listagem",
        iconKey: "list",
        module: "requests",
        href: "/solicitacoes",
        favoriteEnabled: true,
        testId: "nav-requests-list",
      },
      {
        id: "requests-search",
        label: "Buscar solicitação",
        iconKey: "search",
        module: "requests",
        href: "/solicitacoes?focus=search",
        action: "focusSearch",
        favoriteEnabled: true,
        testId: "nav-requests-search",
      },
      {
        id: "requests-identity",
        label: "Identidade de solicitações",
        iconKey: "shield",
        module: "requests",
        href: "/solicitacoes",
        favoriteEnabled: true,
        testId: "nav-requests-identity",
      },
    ],
  },

  // ============================================
  // SUPORTE — All users
  // Removed: Meus chamados, Solicitações de acesso/perfil, Base de conhecimento
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
        label: "Abrir chamado", 
        iconKey: "plus-circle", 
        module: "support", 
        href: "/suporte?modal=create", 
        action: "openCreateModal",
        favoriteEnabled: true,
        testId: "nav-support-create",
      },
      { 
        id: "support-kanban", 
        label: "Andamento dos chamados", 
        iconKey: "kanban", 
        module: "support", 
        href: "/suporte/kanban",
        favoriteEnabled: true,
        testId: "nav-support-kanban",
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
        label: "Lista de conversas", 
        iconKey: "message-square", 
        module: "chat", 
        href: "/chat",
        favoriteEnabled: true,
        testId: "nav-chat-list",
      },
      { 
        id: "chat-search", 
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
    label: "Brain",
    iconKey: "cpu",
    allowedRoles: ALL_USERS,
    testId: "nav-brain",
    items: [
      { 
        id: "brain-graph", 
        label: "Gráfico do Brain", 
        iconKey: "network", 
        module: "brain", 
        href: "/brain",
        favoriteEnabled: true,
        testId: "nav-brain-graph",
      },
      { 
        id: "brain-ask", 
        label: "Perguntar ao assistente", 
        iconKey: "help-circle", 
        module: "brain", 
        href: "/brain/perguntar",
        favoriteEnabled: true,
        testId: "nav-brain-ask",
      },
      { 
        id: "brain-audit-logs", 
        label: "Audit Logs", 
        iconKey: "eye", 
        module: "brain", 
        href: "/audit-logs?source=brain",
        allowedRoles: PRIVILEGED,
        favoriteEnabled: true,
        testId: "nav-brain-audit-logs",
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
        label: "Central de documentos", 
        iconKey: "folder", 
        module: "documents", 
        href: "/documentos",
        favoriteEnabled: true,
        testId: "nav-documents-central",
      },
      { 
        id: "docs-repository", 
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
  // GERENCIAR USUÁRIOS — Only PRIVILEGED users
  // ============================================
  {
    id: "users",
    label: "Gerenciar Usuários",
    iconKey: "users",
    allowedRoles: PRIVILEGED,
    testId: "nav-users",
    items: [
      { 
        id: "users-create-leader-tc", 
        label: "Criar líder TC", 
        iconKey: "plus-circle", 
        module: "users", 
        href: "/usuarios?modal=create&role=leader_tc", 
        action: "openCreateModal",
        allowedRoles: LEADER_ONLY,
        favoriteEnabled: true,
        testId: "nav-users-create-leader-tc",
      },
      { 
        id: "users-create-support", 
        label: "Criar suporte técnico", 
        iconKey: "plus-circle", 
        module: "users", 
        href: "/usuarios?modal=create&role=technical_support", 
        action: "openCreateModal",
        favoriteEnabled: true,
        testId: "nav-users-create-support",
      },
      { 
        id: "users-create-user-tc", 
        label: "Criar usuário TC", 
        iconKey: "plus-circle", 
        module: "users", 
        href: "/usuarios?modal=create&role=testing_company_user", 
        action: "openCreateModal",
        favoriteEnabled: true,
        testId: "nav-users-create-user-tc",
      },
      { 
        id: "users-create-company-user", 
        label: "Criar usuário da empresa", 
        iconKey: "plus-circle", 
        module: "users", 
        href: "/usuarios?modal=create&role=company_user", 
        action: "openCreateModal",
        favoriteEnabled: true,
        testId: "nav-users-create-company-user",
      },
      { 
        id: "users-list", 
        label: "Listagem de usuários", 
        iconKey: "list", 
        module: "users", 
        href: "/usuarios",
        favoriteEnabled: true,
        testId: "nav-users-list",
      },
    ],
  },

  // ============================================
  // ADMIN — Only PRIVILEGED users
  // ============================================
  {
    id: "admin",
    label: "Admin",
    iconKey: "shield",
    allowedRoles: PRIVILEGED,
    testId: "nav-admin",
    items: [
      { 
        id: "admin-permissions", 
        label: "Gestão de permissões", 
        iconKey: "lock", 
        module: "admin", 
        href: "/admin/permissoes",
        favoriteEnabled: true,
        testId: "nav-admin-permissions",
      },
      { 
        id: "admin-audit-logs", 
        label: "Audit Logs", 
        iconKey: "eye", 
        module: "admin", 
        href: "/audit-logs?source=admin",
        favoriteEnabled: true,
        testId: "nav-admin-audit-logs",
      },
    ],
  },
];
