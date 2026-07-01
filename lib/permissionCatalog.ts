export type PermissionModuleCategory =
  | "Módulos e páginas"
  | "Chamados e suporte"
  | "Usuários e administração"
  | "Produtividade"
  | "Operação";

export type PermissionModule = {
  id: string;
  label: string;
  description: string;
  category: PermissionModuleCategory;
  actions: string[];
};

export const ACTION_LABELS: Record<string, string> = {
  read: "Ler",
  view: "Visualizar",
  create: "Criar",
  update: "Atualizar",
  edit: "Editar",
  delete: "Excluir",
  import: "Importar",
  export: "Exportar",
  execute: "Executar",
  assign: "Atribuir responsável",
  status: "Alterar status",
  comment: "Comentar",
  modal: "Acessar modal",
  floating: "Acessar botão flutuante",
  use: "Usar",
  approve: "Aprovar",
  reject: "Rejeitar",
  reset: "Restaurar padrão",
  clone: "Clonar permissões",
  block: "Bloquear",
  view_all: "Ver todos",
  view_company: "Ver da empresa",
  view_own: "Ver próprios",
  global_overview: "Visão global",
  switch_company: "Trocar empresa",
  switch_project: "Trocar projeto",
  view_all_companies: "Ver todas as empresas",
  view_linked_companies: "Ver empresas vinculadas",
  view_own_company: "Ver própria empresa",
  view_all_projects: "Ver todos os projetos",
  view_linked_projects: "Ver projetos vinculados",
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "dashboard",
    label: "Visão Geral",
    description: "Visão global, executiva ou contextual conforme o perfil.",
    category: "Módulos e páginas",
    actions: ["view"],
  },
  {
    id: "context",
    label: "Troca de contexto",
    description: "Controle de visão global, troca de empresa e troca de projeto.",
    category: "Módulos e páginas",
    actions: [
      "global_overview",
      "switch_company",
      "switch_project",
      "view_all_companies",
      "view_linked_companies",
      "view_own_company",
      "view_all_projects",
      "view_linked_projects",
    ],
  },
  {
    id: "applications",
    label: "Empresas e aplicações",
    description: "Cadastro e consulta de empresas, clientes e aplicações.",
    category: "Módulos e páginas",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    id: "metrics",
    label: "Métricas",
    description: "Indicadores, qualidade e leitura de saúde por empresa.",
    category: "Módulos e páginas",
    actions: ["view", "export"],
  },
  {
    id: "operations",
    label: "Operacional",
    description: "Exibição da área operacional, dashboard, métricas e busca operacional.",
    category: "Módulos e páginas",
    actions: ["view"],
  },
  {
    id: "testPlans",
    label: "Planos de teste",
    description: "Planos, campanhas e cobertura de teste por aplicação.",
    category: "Operação",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "test_repository",
    label: "Casos de teste",
    description: "Repositório central de casos e artefatos de teste.",
    category: "Operação",
    actions: ["read", "create", "update", "delete", "import"],
  },
  {
    id: "test_plan",
    label: "Planos por empresa",
    description: "Planejamento e cobertura de ciclos de teste no contexto da empresa.",
    category: "Operação",
    actions: ["read", "create", "update", "delete"],
  },
  {
    id: "test_run",
    label: "Runs por empresa",
    description: "Execuções manuais, automatizadas e regressivas por empresa/projeto.",
    category: "Operação",
    actions: ["read", "create", "update", "delete"],
  },
  {
    id: "playwright",
    label: "Automação Playwright",
    description: "Criação, leitura e execução de automações.",
    category: "Operação",
    actions: ["read", "execute"],
  },
  {
    id: "defect_tracking",
    label: "Gestão de defeitos",
    description: "Defeitos, responsáveis, status e criticidade por contexto permitido.",
    category: "Operação",
    actions: ["read", "create", "update", "delete", "assign", "status"],
  },
  {
    id: "release_management",
    label: "Gestão de releases",
    description: "Releases, decisões de qualidade e bloqueios de entrega.",
    category: "Operação",
    actions: ["read", "create", "approve", "block"],
  },
  {
    id: "releases",
    label: "Releases",
    description: "Fluxo de releases, histórico e qualidade.",
    category: "Operação",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "runs",
    label: "Runs",
    description: "Execuções, suítes e resultados de teste.",
    category: "Operação",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    id: "defects",
    label: "Defeitos",
    description: "Registro e acompanhamento de defeitos.",
    category: "Operação",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "documents",
    label: "Documentos",
    description: "Documentos, evidências e links do contexto da empresa.",
    category: "Produtividade",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "notes",
    label: "Notas",
    description: "Anotações e observações auxiliares.",
    category: "Produtividade",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "notifications",
    label: "Notificações",
    description: "Alertas e central de notificações.",
    category: "Produtividade",
    actions: ["view", "create"],
  },
  {
    id: "settings",
    label: "Meu perfil",
    description: "Dados da conta, preferências e segurança pessoal.",
    category: "Produtividade",
    actions: ["view", "edit"],
  },
  {
    id: "ai",
    label: "Assistente IA",
    description: "Chat assistido, automações inteligentes e mensagens geradas com contexto.",
    category: "Produtividade",
    actions: ["view", "use"],
  },
  {
    id: "brain",
    label: "Brain",
    description: "Grafo de conhecimento e leitura contextual permitida para o perfil.",
    category: "Produtividade",
    actions: ["view", "read", "use"],
  },
  {
    id: "chat",
    label: "Chat",
    description: "Conversas, busca de mensagens e comunicação dentro do workspace.",
    category: "Produtividade",
    actions: ["view", "use"],
  },
  {
    id: "tickets",
    label: "Chamados",
    description: "Kanban, listagem e ações principais dos chamados.",
    category: "Chamados e suporte",
    actions: ["view", "create", "edit", "delete", "assign", "status", "comment", "view_own", "view_company", "view_all"],
  },
  {
    id: "support",
    label: "Suporte",
    description: "Entradas de suporte pela tela, pelo modal e pelo botão flutuante.",
    category: "Chamados e suporte",
    actions: ["view", "create", "assign", "status", "comment", "modal", "floating"],
  },
  {
    id: "users",
    label: "Usuários",
    description: "Consulta e manutenção de usuários.",
    category: "Usuários e administração",
    actions: ["view", "create", "edit", "delete", "view_company", "view_all"],
  },
  {
    id: "permissions",
    label: "Permissões",
    description: "Tela administrativa de personalização por tipo de perfil.",
    category: "Usuários e administração",
    actions: ["view", "edit", "reset", "clone"],
  },
  {
    id: "access_requests",
    label: "Solicitações de acesso",
    description: "Fila de aprovação e rejeição de acessos.",
    category: "Usuários e administração",
    actions: ["view", "comment", "approve", "reject"],
  },
  {
    id: "audit",
    label: "Auditoria",
    description: "Logs administrativos e rastreabilidade.",
    category: "Usuários e administração",
    actions: ["view", "export"],
  },
];

export function getPermissionModule(moduleId: string) {
  return PERMISSION_MODULES.find((item) => item.id === moduleId) ?? null;
}

export function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}
