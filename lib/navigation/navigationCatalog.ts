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
  href?: string;
  companyRoute?: string;
  children?: NavItemDef[];
  allowedRoles?: SystemRole[];
  onlyRoles?: SystemRole[];
  favoriteEnabled?: boolean;
};

export type NavModuleDef = {
  id: NavModule;
  label: string;
  iconKey: string;
  href?: string;
  items: NavItemDef[];
  allowedRoles?: SystemRole[];
};

const ALL_INTERNAL: SystemRole[] = ["leader_tc", "technical_support", "testing_company_user"];
const PRIVILEGED: SystemRole[] = ["leader_tc", "technical_support"];
const LEADER_ONLY: SystemRole[] = ["leader_tc"];

export const NAV_CATALOG: NavModuleDef[] = [
  {
    id: "companies",
    label: "Empresas",
    iconKey: "building",
    allowedRoles: ALL_INTERNAL,
    items: [
      { id: "companies-listing", label: "Listagem",        iconKey: "layout",      module: "companies", href: "/empresas",      favoriteEnabled: true },
      { id: "companies-list",    label: "Buscar empresa",  iconKey: "list",        module: "companies", href: "/empresas",      favoriteEnabled: true },
      { id: "companies-create",  label: "Criar empresa",   iconKey: "plus-circle", module: "companies", href: "/admin/clients", allowedRoles: PRIVILEGED, favoriteEnabled: true },
    ],
  },
  {
    id: "operations",
    label: "Operação",
    iconKey: "monitor",
    allowedRoles: PRIVILEGED,
    items: [
      { id: "ops-dashboard", label: "Dashboard", iconKey: "compass",   module: "operations", companyRoute: "dashboard", href: "/admin/dashboard",   favoriteEnabled: true },
      { id: "ops-metrics",   label: "Métricas",  iconKey: "bar-chart", module: "operations", companyRoute: "metrics",   href: "/admin/test-metric", favoriteEnabled: true },
      { id: "ops-search",    label: "Buscar",    iconKey: "search",    module: "operations", href: "/operacao",                                      favoriteEnabled: true },
    ],
  },
  {
    id: "quality",
    label: "Qualidade",
    iconKey: "check-circle",
    items: [
      { id: "quality-cases",    label: "Casos de Teste",  iconKey: "clipboard",    module: "quality", href: "/casos-de-teste",                                               favoriteEnabled: true },
      { id: "quality-plans",    label: "Planos de Teste", iconKey: "book",         module: "quality", companyRoute: "planos-de-teste",                                       favoriteEnabled: true },
      { id: "quality-runs",     label: "Runs de Teste",   iconKey: "play",         module: "quality", companyRoute: "runs",                                                  favoriteEnabled: true },
      { id: "quality-defects",  label: "Defeitos",        iconKey: "alert-circle", module: "quality", companyRoute: "defeitos",        href: "/admin/defeitos",               favoriteEnabled: true },
      { id: "quality-releases", label: "Releases",        iconKey: "package",      module: "quality", companyRoute: "releases",        href: "/admin/releases",              favoriteEnabled: true },
      { id: "quality-coverage", label: "Cobertura",       iconKey: "pie-chart",    module: "quality", href: "/metrics",                 allowedRoles: ALL_INTERNAL,           favoriteEnabled: true },
      { id: "quality-evidence", label: "Evidências",      iconKey: "image",        module: "quality", companyRoute: "runs",             allowedRoles: ALL_INTERNAL,           favoriteEnabled: true },
    ],
  },
  {
    id: "automation",
    label: "Automações",
    iconKey: "zap",
    allowedRoles: ALL_INTERNAL,
    items: [
      { id: "auto-playwright",label: "Playwright",            iconKey: "zap",        module: "automation", href: "/automacoes/playwright", favoriteEnabled: true },
      { id: "auto-ui-studio", label: "UI Studio",             iconKey: "monitor",    module: "automation", href: "/automacoes/ui-studio",  favoriteEnabled: true },
      { id: "auto-execucoes", label: "Execuções",             iconKey: "play",       module: "automation", href: "/automacoes/execucoes",  favoriteEnabled: true },
      { id: "auto-fluxos",    label: "Fluxos automatizados",  iconKey: "git-branch", module: "automation", href: "/automacoes/fluxos",     favoriteEnabled: true },
      { id: "auto-casos",     label: "Casos automatizados",   iconKey: "clipboard",  module: "automation", href: "/automacoes/casos",      favoriteEnabled: true },
      { id: "auto-scripts",   label: "Scripts",               iconKey: "code",       module: "automation", href: "/automacoes/scripts",    favoriteEnabled: true },
      { id: "auto-tools",     label: "Ferramentas",           iconKey: "tool",       module: "automation", href: "/automacoes/tools",      favoriteEnabled: true },
      { id: "auto-logs",      label: "Logs",                  iconKey: "file-text",  module: "automation", href: "/automacoes/logs",       favoriteEnabled: true },
    ],
  },
  {
    id: "support",
    label: "Suporte",
    iconKey: "help-circle",
    items: [
      { id: "support-my-tickets",       label: "Meus chamados",           iconKey: "inbox",          module: "support", href: "/meus-chamados",                     favoriteEnabled: true },
      { id: "support-tickets",          label: "Chamados",                iconKey: "message-square", module: "support", companyRoute: "chamados", href: "/admin/chamados", allowedRoles: PRIVILEGED, favoriteEnabled: true },
      { id: "support-create",           label: "Criar chamado",           iconKey: "plus-circle",    module: "support", href: "/chamados",                          favoriteEnabled: true },
      { id: "support-access-requests",  label: "Solicitações de acesso",  iconKey: "user-plus",      module: "support", href: "/admin/access-requests",             allowedRoles: PRIVILEGED, favoriteEnabled: true },
      { id: "support-profile-requests", label: "Solicitações de perfil",  iconKey: "shield",         module: "support", href: "/admin/requests",                    allowedRoles: PRIVILEGED, favoriteEnabled: true },
      { id: "support-docs",             label: "Base de conhecimento",    iconKey: "book-open",      module: "support", href: "/admin/docs",                        favoriteEnabled: true },
    ],
  },
  {
    id: "brain",
    label: "Brain / IA",
    iconKey: "cpu",
    items: [
      { id: "brain-chat",     label: "Assistente",            iconKey: "message-circle", module: "brain", href: "/chat",        favoriteEnabled: true },
      { id: "brain-company",  label: "Assistente da empresa", iconKey: "message-square", module: "brain", href: "/conversas", favoriteEnabled: true },
      { id: "brain-admin",    label: "Brain Admin",           iconKey: "cpu",            module: "brain", href: "/admin/brain", allowedRoles: PRIVILEGED, favoriteEnabled: true },
      { id: "brain-memories", label: "Memórias",              iconKey: "database",       module: "brain", href: "/admin/brain", allowedRoles: PRIVILEGED, favoriteEnabled: true },
      { id: "brain-context",  label: "Contexto atual",        iconKey: "layers",         module: "brain", href: "/admin/brain", allowedRoles: PRIVILEGED, favoriteEnabled: true },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    iconKey: "shield",
    allowedRoles: PRIVILEGED,
    items: [
      { id: "admin-users",        label: "Gerenciar usuários",      iconKey: "users",    module: "admin", href: "/admin/users",             favoriteEnabled: true },
      { id: "admin-permissions",  label: "Perfis e permissões",     iconKey: "lock",     module: "admin", href: "/admin/users/permissions", allowedRoles: LEADER_ONLY, favoriteEnabled: true },
      { id: "admin-audit",        label: "Audit Logs",              iconKey: "eye",      module: "admin", href: "/admin/audit-logs",        favoriteEnabled: true },
      { id: "admin-integrations", label: "Integrações globais",     iconKey: "link",     module: "admin", href: "/applications-hub",        allowedRoles: LEADER_ONLY, favoriteEnabled: true },
      { id: "admin-settings",     label: "Configurações do sistema",iconKey: "sliders",  module: "admin", href: "/settings",                allowedRoles: LEADER_ONLY, favoriteEnabled: true },
    ],
  },
  {
    id: "documents",
    label: "Documentos",
    iconKey: "file-text",
    items: [
      { id: "docs-central",   label: "Central de documentos", iconKey: "folder",    module: "documents", href: "/documentos",                                      favoriteEnabled: true },
      { id: "docs-company",   label: "Documentos da empresa", iconKey: "file-text", module: "documents", companyRoute: "documentos",  href: "/documentos",         favoriteEnabled: true },
      { id: "docs-technical", label: "Documentação técnica",  iconKey: "book",      module: "documents", href: "/documentacao",        allowedRoles: ALL_INTERNAL,  favoriteEnabled: true },
      { id: "docs-evidence",  label: "Evidências",            iconKey: "image",     module: "documents", href: "/documentos",          allowedRoles: ALL_INTERNAL,  favoriteEnabled: true },
      { id: "docs-exports",   label: "Exportações",           iconKey: "download",  module: "documents", href: "/documentos",          allowedRoles: ALL_INTERNAL,  favoriteEnabled: true },
    ],
  },
];