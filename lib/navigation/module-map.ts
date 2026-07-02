import type { SystemModuleDefinition } from "./navigation.types";

export const SYSTEM_MODULES = [
  {
    id: "empresas",
    name: "Empresas",
    description: "Cadastro, contexto e operaÃ§Ã£o das empresas atendidas.",
    mainRoute: "/admin/clients",
    basePermission: { moduleId: "applications", action: "view" },
    status: "ativo",
  },
  {
    id: "usuarios",
    name: "UsuÃ¡rios",
    description: "GestÃ£o de usuários internos e vinculados a empresas.",
    mainRoute: "/admin/users",
    basePermission: { moduleId: "users", action: "view" },
    status: "ativo",
  },
  {
    id: "agenda",
    name: "Agenda",
    description: "Calendário operacional para acompanhamento de marcações e entregas.",
    mainRoute: "/agenda",
    basePermission: { moduleId: "release_calendar", action: "view" },
    status: "ativo",
  },
  {
    id: "permissoes",
    name: "Gestão de permissões",
    description: "Perfis, matriz de acesso e sobrescritas por usuário.",
    mainRoute: "/admin/permissions",
    basePermission: { moduleId: "permissions", action: "view" },
    status: "parcial",
  },
  {
    id: "testes-manuais",
    name: "Testes Manuais",
    description: "Casos, planos, execuÃ§Ãµes, releases e defeitos.",
    mainRoute: "/casos-de-teste",
    basePermission: { moduleId: "test_repository", action: "read" },
    status: "ativo",
  },
  {
    id: "automacao",
    name: "AutomaÃ§Ã£o",
    description: "Playwright, execuÃ§Ãµes, ativos, scripts e ferramentas.",
    mainRoute: "/automacoes",
    basePermission: { moduleId: "playwright", action: "read" },
    status: "parcial",
  },
  {
    id: "brain",
    name: "Brain",
    description: "Grafo de conhecimento e recursos internos do Brain.",
    mainRoute: "/brain",
    basePermission: { moduleId: "brain", action: "view" },
    status: "parcial",
  },
  {
    id: "assistente",
    name: "Assistente",
    description: "Consulta assistida e aÃ§Ãµes apoiadas por IA.",
    mainRoute: "/brain",
    basePermission: { moduleId: "ai", action: "use" },
    status: "parcial",
  },
  {
    id: "chat",
    name: "Chat",
    description: "Conversas e contatos entre usuários da plataforma.",
    mainRoute: "/chat",
    basePermission: null,
    status: "parcial",
  },
  {
    id: "suporte",
    name: "Suporte",
    description: "Abertura, acompanhamento e operaÃ§Ã£o de chamados.",
    mainRoute: "/suporte",
    basePermission: { moduleId: "support", action: "view" },
    status: "ativo",
  },
  {
    id: "agenda",
    name: "Agenda",
    description: "Calendário de releases e compromissos operacionais.",
    mainRoute: "/agenda",
    basePermission: { moduleId: "release_calendar", action: "view" },
    status: "ativo",
  },
  {
    id: "solicitacoes",
    name: "SolicitaÃ§Ãµes",
    description: "SolicitaÃ§Ãµes de acesso e alteraÃ§Ãµes administrativas.",
    mainRoute: "/solicitacoes",
    basePermission: { moduleId: "access_requests", action: "view" },
    status: "parcial",
  },
  {
    id: "documentos",
    name: "Documentos",
    description: "Central, repositÃ³rio e documentaÃ§Ã£o da plataforma.",
    mainRoute: "/documentos",
    basePermission: { moduleId: "documents", action: "view" },
    status: "parcial",
  },
  {
    id: "dashboards",
    name: "VisÃ£o Geral",
    description: "Indicadores globais, administrativos e de empresa.",
    mainRoute: "/dashboard",
    basePermission: { moduleId: "dashboard", action: "view" },
    status: "parcial",
  },
  {
    id: "operacao",
    name: "OperaÃ§Ã£o",
    description: "VisÃµes operacionais, busca e mÃ©tricas consolidadas.",
    mainRoute: "/operacoes",
    basePermission: { moduleId: "operations", action: "view" },
    status: "parcial",
  },
  {
    id: "configuracoes",
    name: "ConfiguraÃ§Ãµes",
    description: "Perfil, preferÃªncias e administraÃ§Ã£o da conta.",
    mainRoute: "/settings/profile",
    basePermission: { moduleId: "settings", action: "view" },
    status: "parcial",
  },
] as const satisfies readonly SystemModuleDefinition[];

export const SYSTEM_MODULE_BY_ID = new Map(
  SYSTEM_MODULES.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition]),
);





