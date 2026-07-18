import type { SystemPermission } from "@/backend/navigation/navigation.types";
import type { BrainNavigationTarget, BrainNodeActionId } from "@/backend/brain/actions";

export type BrainEntitySourceType =
  | "database"
  | "catalog"
  | "route-map"
  | "permission-catalog"
  | "audit"
  | "computed"
  | "integration";

export type BrainCanonicalEntityType =
  | "module"
  | "route"
  | "profile"
  | "permission"
  | "user"
  | "company"
  | "project"
  | "run"
  | "test_plan"
  | "test_case"
  | "defect"
  | "ticket"
  | "automation"
  | "document"
  | "metric"
  | "audit";

export type BrainEntityRegistryEntry = {
  id: BrainCanonicalEntityType;
  label: string;
  description: string;
  type: string;
  source: {
    type: BrainEntitySourceType;
    table?: string;
    route?: string;
    generatedBy?: string;
  };
  requiredPermissions: SystemPermission[];
  aliases: string[];
  tags: string[];
  lifecycle: Array<"created" | "active" | "updated" | "archived" | "deleted" | "blocked_by_permission" | "orphan" | "stale">;
  routeBuilder: (input: { id?: string; companyId?: string | null; companySlug?: string | null; projectId?: string | null }) => BrainNavigationTarget | null;
  nodeBuilder: string;
  edgeBuilder: string;
  relations: string[];
  availableActions: BrainNodeActionId[];
};

const route = (routeValue: string, label: string): BrainNavigationTarget => ({ label, route: routeValue });

export const brainEntityRegistry: BrainEntityRegistryEntry[] = [
  {
    id: "module",
    label: "Modulo",
    description: "Modulo funcional governado pelo catalogo de permissoes.",
    type: "Module",
    source: { type: "catalog", generatedBy: "PERMISSION_MODULES" },
    requiredPermissions: [{ moduleId: "brain", action: "view" }],
    aliases: ["area", "nucleo", "funcionalidade"],
    tags: ["modulo", "tela", "permissao", "catalogo"],
    lifecycle: ["created", "active", "updated", "blocked_by_permission", "stale"],
    routeBuilder: () => route("/admin/sistema/mapa", "Abrir mapa do sistema"),
    nodeBuilder: "buildModuleNode",
    edgeBuilder: "module_to_routes_permissions",
    relations: ["contains route", "governed_by permission"],
    availableActions: ["open", "navigate", "summarize", "inspect", "explain"],
  },
  {
    id: "route",
    label: "Rota",
    description: "Tela ou endpoint navegavel do sistema.",
    type: "Screen",
    source: { type: "route-map", generatedBy: "SYSTEM_ROUTES" },
    requiredPermissions: [{ moduleId: "brain", action: "view" }],
    aliases: ["tela", "pagina", "endpoint"],
    tags: ["rota", "tela", "navegacao", "permissao"],
    lifecycle: ["created", "active", "updated", "blocked_by_permission", "stale"],
    routeBuilder: ({ id }) => route(id?.startsWith("/") ? id : "/brain", "Abrir rota"),
    nodeBuilder: "buildRouteNode",
    edgeBuilder: "route_to_module_permission",
    relations: ["belongs_to module", "requires permission"],
    availableActions: ["open", "navigate", "inspect", "explain"],
  },
  {
    id: "profile",
    label: "Perfil",
    description: "Perfil funcional usado para calcular permissoes efetivas.",
    type: "Profile",
    source: { type: "permission-catalog", generatedBy: "ROLE_DEFAULTS" },
    requiredPermissions: [{ moduleId: "permissions", action: "view" }],
    aliases: ["papel", "role", "tipo de usuario"],
    tags: ["perfil", "permissao", "acesso", "central de acessos"],
    lifecycle: ["created", "active", "updated", "blocked_by_permission"],
    routeBuilder: () => route("/admin/users/permissions", "Abrir Central de Acessos"),
    nodeBuilder: "buildProfileNode",
    edgeBuilder: "profile_to_permission_actions",
    relations: ["grants permission", "contains users"],
    availableActions: ["open", "summarize", "inspect", "explain", "edit"],
  },
  {
    id: "permission",
    label: "Permissao",
    description: "Acao liberada ou bloqueada pela matriz de acesso.",
    type: "PermissionAction",
    source: { type: "permission-catalog", generatedBy: "PERMISSION_MODULES" },
    requiredPermissions: [{ moduleId: "permissions", action: "view" }],
    aliases: ["acesso", "capacidade", "acao"],
    tags: ["permissao", "acesso", "perfil", "bloqueio"],
    lifecycle: ["created", "active", "updated", "blocked_by_permission"],
    routeBuilder: () => route("/admin/users/permissions", "Abrir Central de Acessos"),
    nodeBuilder: "buildPermissionNode",
    edgeBuilder: "permission_to_route_action",
    relations: ["allows action", "blocks action", "impacts route"],
    availableActions: ["inspect", "explain", "open"],
  },
  {
    id: "user",
    label: "Usuario",
    description: "Pessoa autenticada, solicitante, responsavel ou ator de auditoria.",
    type: "User",
    source: { type: "database", table: "User" },
    requiredPermissions: [{ moduleId: "users", action: "view" }],
    aliases: ["pessoa", "conta", "ator"],
    tags: ["usuario", "perfil", "empresa", "auditoria"],
    lifecycle: ["created", "active", "updated", "archived", "deleted", "blocked_by_permission"],
    routeBuilder: () => route("/admin/users", "Abrir usuarios"),
    nodeBuilder: "buildUserNode",
    edgeBuilder: "user_to_profile_company_events",
    relations: ["member_of company", "has profile", "created event"],
    availableActions: ["open", "summarize", "inspect", "filter", "explain", "edit"],
  },
  {
    id: "company",
    label: "Empresa",
    description: "Tenant/cliente com projetos, usuarios, qualidade e integracoes.",
    type: "Company",
    source: { type: "database", table: "Company" },
    requiredPermissions: [{ moduleId: "applications", action: "view" }],
    aliases: ["cliente", "tenant", "organizacao"],
    tags: ["empresa", "cliente", "projeto", "operacional"],
    lifecycle: ["created", "active", "updated", "archived", "deleted", "blocked_by_permission"],
    routeBuilder: ({ companySlug }) => route(companySlug ? `/empresas/${companySlug}/home` : "/admin/clients", "Abrir empresa"),
    nodeBuilder: "buildCompanyNode",
    edgeBuilder: "company_to_projects_users_quality",
    relations: ["contains project", "contains user", "uses integration"],
    availableActions: ["open", "summarize", "inspect", "filter", "export", "explain"],
  },
  {
    id: "project",
    label: "Projeto",
    description: "Projeto/aplicacao dentro de uma empresa.",
    type: "Application",
    source: { type: "database", table: "Project/Application" },
    requiredPermissions: [{ moduleId: "applications", action: "view" }],
    aliases: ["aplicacao", "produto", "sistema"],
    tags: ["projeto", "aplicacao", "empresa", "qualidade"],
    lifecycle: ["created", "active", "updated", "archived", "deleted", "orphan", "blocked_by_permission"],
    routeBuilder: ({ companySlug }) => route(companySlug ? `/empresas/${companySlug}/aplicacoes` : "/admin/clients", "Abrir projeto"),
    nodeBuilder: "buildProjectNode",
    edgeBuilder: "project_to_quality_entities",
    relations: ["belongs_to company", "contains test case", "contains defect"],
    availableActions: ["open", "summarize", "inspect", "filter", "explain"],
  },
  {
    id: "run",
    label: "Run",
    description: "Execucao de testes manual, automatizada ou vinda de integracao.",
    type: "TestRun",
    source: { type: "database", table: "TestRun" },
    requiredPermissions: [{ moduleId: "test_run", action: "read" }, { moduleId: "runs", action: "view" }],
    aliases: ["execucao", "suite", "resultado"],
    tags: ["run", "execucao", "teste", "resultado", "qase"],
    lifecycle: ["created", "active", "updated", "archived", "orphan", "blocked_by_permission"],
    routeBuilder: ({ id, companySlug }) => route(id ? `/runs/${id}` : companySlug ? `/empresas/${companySlug}/runs` : "/brain", "Abrir run"),
    nodeBuilder: "buildRunNode",
    edgeBuilder: "run_to_case_result_defect",
    relations: ["executes case", "has result", "linked_to defect"],
    availableActions: ["open", "summarize", "inspect", "filter", "export", "explain"],
  },
  {
    id: "test_plan",
    label: "Plano de teste",
    description: "Plano/ciclo/campanha com escopo e cobertura.",
    type: "TestPlan",
    source: { type: "database", table: "ManualTestPlan/TestPlan" },
    requiredPermissions: [{ moduleId: "test_plan", action: "read" }],
    aliases: ["plano", "campanha", "ciclo"],
    tags: ["plano", "teste", "cobertura", "projeto"],
    lifecycle: ["created", "active", "updated", "archived", "orphan", "blocked_by_permission"],
    routeBuilder: ({ companySlug }) => route(companySlug ? `/empresas/${companySlug}/planos-de-teste` : "/brain", "Abrir plano de teste"),
    nodeBuilder: "buildTestPlanNode",
    edgeBuilder: "plan_to_cases_runs",
    relations: ["contains case", "planned_for project"],
    availableActions: ["open", "summarize", "inspect", "filter", "export", "explain"],
  },
  {
    id: "test_case",
    label: "Caso de teste",
    description: "Caso manual, importado, integrado ou automatizado.",
    type: "TestCase",
    source: { type: "database", table: "TestCase" },
    requiredPermissions: [{ moduleId: "test_repository", action: "read" }],
    aliases: ["caso", "cenario", "teste"],
    tags: ["caso", "teste", "automacao", "qase"],
    lifecycle: ["created", "active", "updated", "archived", "orphan", "blocked_by_permission"],
    routeBuilder: () => route("/casos-de-teste", "Abrir casos de teste"),
    nodeBuilder: "buildTestCaseNode",
    edgeBuilder: "case_to_plan_run_automation",
    relations: ["belongs_to plan", "executed_in run", "automated_by script"],
    availableActions: ["open", "summarize", "inspect", "filter", "create", "edit", "export", "explain"],
  },
  {
    id: "defect",
    label: "Defeito",
    description: "Bug/falha com status, severidade, evidencia e relacoes.",
    type: "Defect",
    source: { type: "database", table: "Defect/KanbanCard" },
    requiredPermissions: [{ moduleId: "defect_tracking", action: "read" }, { moduleId: "defects", action: "view" }],
    aliases: ["bug", "falha", "erro"],
    tags: ["defeito", "bug", "falha", "run", "ticket"],
    lifecycle: ["created", "active", "updated", "archived", "deleted", "orphan", "blocked_by_permission"],
    routeBuilder: ({ companySlug, projectId }) => route(companySlug ? `/empresas/${companySlug}/defeitos${projectId ? `?project=${projectId}` : ""}` : "/brain", "Abrir defeitos"),
    nodeBuilder: "buildDefectNode",
    edgeBuilder: "defect_to_run_ticket_case",
    relations: ["found_in run", "linked_to ticket", "related_to case"],
    availableActions: ["open", "summarize", "inspect", "filter", "create", "edit", "export", "explain"],
  },
  {
    id: "ticket",
    label: "Ticket",
    description: "Chamado interno ou ticket externo vinculado.",
    type: "Ticket",
    source: { type: "database", table: "Ticket" },
    requiredPermissions: [{ moduleId: "tickets", action: "view" }],
    aliases: ["chamado", "suporte", "demanda"],
    tags: ["ticket", "chamado", "suporte", "usuario"],
    lifecycle: ["created", "active", "updated", "archived", "deleted", "blocked_by_permission"],
    routeBuilder: () => route("/chamados", "Abrir chamados"),
    nodeBuilder: "buildTicketNode",
    edgeBuilder: "ticket_to_user_company_defect",
    relations: ["created_by user", "belongs_to company", "linked_to defect"],
    availableActions: ["open", "summarize", "inspect", "filter", "create", "edit", "export", "explain"],
  },
  {
    id: "automation",
    label: "Automacao",
    description: "Script, fluxo ou execucao automatizada.",
    type: "AutomationScript",
    source: { type: "database", table: "Automation" },
    requiredPermissions: [{ moduleId: "playwright", action: "read" }],
    aliases: ["script", "playwright", "robo"],
    tags: ["automacao", "playwright", "script", "run"],
    lifecycle: ["created", "active", "updated", "archived", "orphan", "blocked_by_permission"],
    routeBuilder: () => route("/automacoes", "Abrir automacoes"),
    nodeBuilder: "buildAutomationNode",
    edgeBuilder: "automation_to_case_run",
    relations: ["automates case", "generates run", "produces evidence"],
    availableActions: ["open", "summarize", "inspect", "filter", "create", "edit", "export", "explain"],
  },
  {
    id: "document",
    label: "Documento",
    description: "Documento, evidencia, nota, PDF ou conhecimento anexado.",
    type: "Document",
    source: { type: "database", table: "Document/UserNote" },
    requiredPermissions: [{ moduleId: "documents", action: "view" }],
    aliases: ["doc", "evidencia", "nota", "pdf"],
    tags: ["documento", "evidencia", "wiki", "memoria"],
    lifecycle: ["created", "active", "updated", "archived", "deleted", "orphan", "blocked_by_permission"],
    routeBuilder: () => route("/documentos", "Abrir documentos"),
    nodeBuilder: "buildDocumentNode",
    edgeBuilder: "document_to_entity_author",
    relations: ["documents node", "created_by user"],
    availableActions: ["open", "summarize", "inspect", "filter", "create", "edit", "export", "explain"],
  },
  {
    id: "metric",
    label: "Metrica",
    description: "Indicador calculado de qualidade, operacao ou saude.",
    type: "Dashboard",
    source: { type: "computed", generatedBy: "quality_metrics" },
    requiredPermissions: [{ moduleId: "metrics", action: "view" }, { moduleId: "dashboard", action: "view" }],
    aliases: ["indicador", "dashboard", "painel"],
    tags: ["metrica", "dashboard", "qualidade", "operacional"],
    lifecycle: ["created", "active", "updated", "stale", "blocked_by_permission"],
    routeBuilder: () => route("/operacoes/dashboard", "Abrir painel operacional"),
    nodeBuilder: "buildMetricNode",
    edgeBuilder: "metric_to_company_project_run",
    relations: ["computed_from run", "belongs_to company"],
    availableActions: ["open", "summarize", "inspect", "filter", "export", "explain"],
  },
  {
    id: "audit",
    label: "Auditoria",
    description: "Evento, log, snapshot ou trilha de acesso.",
    type: "AuditEvent",
    source: { type: "audit", table: "AuditLog/BrainAuditLog" },
    requiredPermissions: [{ moduleId: "audit", action: "view" }],
    aliases: ["log", "historico", "evento"],
    tags: ["auditoria", "log", "evento", "permissao"],
    lifecycle: ["created", "active", "archived", "blocked_by_permission"],
    routeBuilder: () => route("/audit-logs?source=admin", "Abrir auditoria"),
    nodeBuilder: "buildAuditNode",
    edgeBuilder: "audit_to_actor_target",
    relations: ["created_by actor", "changed entity", "snapshots permission"],
    availableActions: ["open", "summarize", "inspect", "filter", "export", "explain"],
  },
];

export const brainEntityRegistryById = new Map(brainEntityRegistry.map((entry) => [entry.id, entry]));

export function getBrainEntityRegistryEntry(id: string | null | undefined) {
  return id ? brainEntityRegistryById.get(id as BrainCanonicalEntityType) ?? null : null;
}

export function listBrainEntityRegistry() {
  return brainEntityRegistry;
}

