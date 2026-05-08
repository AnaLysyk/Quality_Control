import type { SystemRole } from "@/lib/auth/roles";

export type NavModule =
  | "home"
  | "companies"
  | "operations"
  | "quality"
  | "automation"
  | "support"
  | "brain"
  | "admin"
  | "documents";

export type NavItemDef = {
  id: string;
  label: string;
  iconKey: string;
  module: NavModule;
  /** Static global href */
  href?: string;
  /** Route segment used with buildCompanyPathForAccess when in company context */
  companyRoute?: string;
  children?: NavItemDef[];
  /** Undefined = visible to all authenticated users */
  allowedRoles?: SystemRole[];
  /** Only this specific role can see (stricter than allowedRoles) */
  onlyRoles?: SystemRole[];
  favoriteEnabled?: boolean;
};

export type NavModuleDef = {
  id: NavModule;
  label: string;
  iconKey: string;
  /** Href for the module header itself (optional) */
  href?: string;
  items: NavItemDef[];
  /** Undefined = visible to all authenticated users */
  allowedRoles?: SystemRole[];
};

const ALL_INTERNAL: SystemRole[] = ["leader_tc", "technical_support", "testing_company_user"];
const PRIVILEGED: SystemRole[] = ["leader_tc", "technical_support"];
const LEADER_ONLY: SystemRole[] = ["leader_tc"];

export const NAV_CATALOG: NavModuleDef[] = [
  {
    id: "home",
    label: "Home",
    iconKey: "home",
    items: [
      { id: "home-page", label: "Início", iconKey: "home", module: "home", href: "/home", favoriteEnabled: true },
      { id: "home-dashboard", label: "Dashboard", iconKey: "compass", module: "home", href: "/admin/home", allowedRoles: ALL_INTERNAL, favoriteEnabled: true },
    ],
  },
  {
    id: "companies",
    label: "Empresas",
    iconKey: "users",
    allowedRoles: ALL_INTERNAL,
    items: [
      { id: "companies-list", label: "Listar empresas", iconKey: "list", module: "companies", href: "/admin/clients", favoriteEnabled: true },
      { id: "companies-active-home", label: "Empresa ativa", iconKey: "briefcase", module: "companies", companyRoute: "home", favoriteEnabled: true },
      { id: "companies-active-apps", label: "Aplicações", iconKey: "briefcase", module: "companies", companyRoute: "aplicacoes", favoriteEnabled: true },
      { id: "companies-active-plans", label: "Planos de teste", iconKey: "book", module: "companies", companyRoute: "planos-de-teste", favoriteEnabled: true },
      { id: "companies-active-runs", label: "Runs", iconKey: "list", module: "companies", companyRoute: "runs", favoriteEnabled: true },
      { id: "companies-active-defects", label: "Defeitos", iconKey: "alert-circle", module: "companies", companyRoute: "defeitos", favoriteEnabled: true },
      { id: "companies-integrations", label: "Integrações", iconKey: "link", module: "companies", href: "/integrations", favoriteEnabled: true },
    ],
  },
  {
    id: "operations",
    label: "Operações",
    iconKey: "monitor",
    allowedRoles: ALL_INTERNAL,
    items: [
      { id: "ops-dashboard", label: "Dashboard", iconKey: "compass", module: "operations", href: "/admin/dashboard", favoriteEnabled: true },
      { id: "ops-runs", label: "Runs", iconKey: "list", module: "operations", href: "/admin/runs", favoriteEnabled: true },
      { id: "ops-metrics", label: "Métricas", iconKey: "bar-chart", module: "operations", href: "/admin/test-metric", favoriteEnabled: true },
      { id: "ops-kanban", label: "Kanban", iconKey: "layout", module: "operations", href: "/kanban-it", favoriteEnabled: true },
      { id: "ops-audit", label: "Audit Logs", iconKey: "eye", module: "operations", href: "/admin/audit-logs", favoriteEnabled: true },
    ],
  },
  {
    id: "quality",
    label: "Qualidade",
    iconKey: "check-circle",
    items: [
      { id: "quality-cases", label: "Casos de Teste", iconKey: "clipboard", module: "quality", href: "/automacoes/casos", favoriteEnabled: true },
      { id: "quality-plans", label: "Planos de Teste", iconKey: "book", module: "quality", companyRoute: "planos-de-teste", href: "/runs", favoriteEnabled: true },
      { id: "quality-runs", label: "Runs", iconKey: "list", module: "quality", companyRoute: "runs", href: "/runs", favoriteEnabled: true },
      { id: "quality-defects", label: "Defeitos", iconKey: "alert-circle", module: "quality", companyRoute: "defeitos", href: "/admin/defeitos", favoriteEnabled: true },
      { id: "quality-releases", label: "Releases", iconKey: "package", module: "quality", companyRoute: "releases", href: "/admin/releases", favoriteEnabled: true },
    ],
  },
  {
    id: "automation",
    label: "Automações",
    iconKey: "zap",
    allowedRoles: ALL_INTERNAL,
    items: [
      { id: "auto-casos", label: "Casos de Teste", iconKey: "clipboard", module: "automation", href: "/automacoes/casos", favoriteEnabled: true },
      { id: "auto-execucoes", label: "Execuções", iconKey: "list", module: "automation", href: "/automacoes/execucoes", favoriteEnabled: true },
      { id: "auto-fluxos", label: "Fluxos", iconKey: "layout", module: "automation", href: "/automacoes/fluxos", favoriteEnabled: true },
      { id: "auto-scripts", label: "Scripts", iconKey: "code", module: "automation", href: "/automacoes/scripts", favoriteEnabled: true },
      { id: "auto-tools", label: "Ferramentas", iconKey: "settings", module: "automation", href: "/automacoes/tools", favoriteEnabled: true },
      { id: "auto-playwright", label: "Playwright", iconKey: "zap", module: "automation", href: "/automacoes/playwright", favoriteEnabled: true },
      { id: "auto-ui-studio", label: "UI Studio", iconKey: "eye", module: "automation", href: "/automacoes/ui-studio", favoriteEnabled: true },
      { id: "auto-logs", label: "Logs", iconKey: "file-text", module: "automation", href: "/automacoes/logs", favoriteEnabled: true },
    ],
  },
  {
    id: "support",
    label: "Suporte",
    iconKey: "help-circle",
    items: [
      { id: "support-my-tickets", label: "Meus chamados", iconKey: "columns", module: "support", href: "/meus-chamados", favoriteEnabled: true },
      { id: "support-tickets", label: "Chamados", iconKey: "columns", module: "support", companyRoute: "chamados", href: "/chamados", favoriteEnabled: true },
      { id: "support-access-requests", label: "Solicitações de acesso", iconKey: "user-plus", module: "support", href: "/admin/access-requests", favoriteEnabled: true },
      { id: "support-docs", label: "Base de conhecimento", iconKey: "file-text", module: "support", href: "/admin/docs", favoriteEnabled: true },
    ],
  },
  {
    id: "brain",
    label: "Brain / IA",
    iconKey: "cpu",
    items: [
      { id: "brain-chat", label: "Assistente (Global)", iconKey: "message-circle", module: "brain", href: "/chat", favoriteEnabled: true },
      { id: "brain-company", label: "Assistente (Empresa)", iconKey: "message-circle", module: "brain", companyRoute: "chat", favoriteEnabled: true },
      { id: "brain-admin", label: "Brain Admin", iconKey: "cpu", module: "brain", href: "/admin/brain", allowedRoles: PRIVILEGED, favoriteEnabled: true },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    iconKey: "shield",
    allowedRoles: [...PRIVILEGED, "leader_tc"],
    items: [
      { id: "admin-users", label: "Gerenciar Usuários", iconKey: "shield", module: "admin", href: "/admin/users", favoriteEnabled: true },
      { id: "admin-users-permissions", label: "Permissões", iconKey: "shield", module: "admin", href: "/admin/users/permissions", allowedRoles: LEADER_ONLY, favoriteEnabled: true },
      { id: "admin-audit", label: "Audit Logs", iconKey: "eye", module: "admin", href: "/admin/audit-logs", favoriteEnabled: true },
      { id: "admin-integrations", label: "Integrações", iconKey: "link", module: "admin", href: "/integrations", allowedRoles: LEADER_ONLY, favoriteEnabled: true },
      { id: "admin-settings", label: "Configurações", iconKey: "settings", module: "admin", href: "/settings", allowedRoles: LEADER_ONLY, favoriteEnabled: true },
    ],
  },
  {
    id: "documents",
    label: "Documentos",
    iconKey: "file-text",
    items: [
      { id: "docs-central", label: "Central de documentos", iconKey: "file-text", module: "documents", href: "/documentos", favoriteEnabled: true },
      { id: "docs-company", label: "Documentos da empresa", iconKey: "file-text", module: "documents", companyRoute: "documentos", href: "/documentos", favoriteEnabled: true },
      { id: "docs-documentation", label: "Documentação técnica", iconKey: "book", module: "documents", href: "/documentacao", favoriteEnabled: true },
    ],
  },
];
