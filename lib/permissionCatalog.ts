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
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  export: "Exportar",
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
  view_all: "Ver todos",
  view_company: "Ver da empresa",
  view_own: "Ver próprios",
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Página inicial administrativa e indicadores gerais.",
    category: "Módulos e páginas",
    actions: ["view"],
  },
  {
    id: "applications",
    label: "Empresas e aplicações",
    description: "Cadastro e consulta de empresas, clientes e aplicações.",
    category: "Módulos e páginas",
    actions: ["view", "create", "edit", "delete", "export"],
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
    description: "Tela administrativa de personalização por usuário.",
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
    description: "Chat e automações assistidas por IA.",
    category: "Produtividade",
    actions: ["view", "use"],
  },
];

export function getPermissionModule(moduleId: string) {
  return PERMISSION_MODULES.find((item) => item.id === moduleId) ?? null;
}

export function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}
