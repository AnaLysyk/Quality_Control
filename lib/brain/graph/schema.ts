export type BrainProductId = "assistant" | "graph";

export type BrainGraphNodeGroup =
  | "business"
  | "identity"
  | "access"
  | "quality"
  | "system"
  | "delivery"
  | "knowledge"
  | "operations";

export type BrainGraphNodeDefinition = {
  type: string;
  label: string;
  group: BrainGraphNodeGroup;
  color: string;
  description: string;
  aliases: string[];
};

export type BrainGraphEdgeDefinition = {
  type: string;
  label: string;
  description: string;
};

export const BRAIN_PRODUCTS: Array<{
  id: BrainProductId;
  label: string;
  route?: string;
  description: string;
}> = [
  {
    id: "assistant",
    label: "Brain Assistente",
    description: "Copiloto lateral que conversa, explica, navega e executa acoes respeitando contexto e RBAC.",
  },
  {
    id: "graph",
    label: "Brain Graph",
    route: "/brain",
    description: "Knowledge Graph visual que organiza entidades, memoria, permissoes e relacionamentos da plataforma.",
  },
];

export const BRAIN_GRAPH_NODE_TYPES: BrainGraphNodeDefinition[] = [
  { type: "Company", label: "Empresa", group: "business", color: "#0f766e", description: "Empresa, cliente ou tenant da plataforma.", aliases: ["empresa", "cliente", "tenant"] },
  { type: "Project", label: "Projeto", group: "business", color: "#0d9488", description: "Projeto operacional dentro de uma empresa.", aliases: ["projeto", "squad", "produto"] },
  { type: "Application", label: "Aplicacao", group: "business", color: "#0e7490", description: "Aplicacao, produto ou projeto de uma empresa.", aliases: ["aplicacao", "produto", "projeto"] },
  { type: "User", label: "Usuario", group: "identity", color: "#2563eb", description: "Usuario, colaborador, administrador ou solicitante.", aliases: ["usuario", "pessoa", "conta"] },
  { type: "Profile", label: "Perfil", group: "access", color: "#7c3aed", description: "Perfil funcional ou papel de permissao.", aliases: ["perfil", "papel", "role"] },
  { type: "PermissionModule", label: "Modulo de permissao", group: "access", color: "#9333ea", description: "Modulo governado pelo catalogo de permissoes.", aliases: ["permissao", "modulo rbac"] },
  { type: "PermissionAction", label: "Acao de permissao", group: "access", color: "#a855f7", description: "Acao permitida, como visualizar, aprovar, editar ou excluir.", aliases: ["acao", "botao", "capacidade"] },
  { type: "AccessRequest", label: "Solicitacao", group: "business", color: "#dc2626", description: "Solicitacao de acesso, ajuste, aprovacao ou recusa.", aliases: ["solicitacao", "pedido", "aprovacao"] },
  { type: "Ticket", label: "Chamado", group: "operations", color: "#ea580c", description: "Chamado operacional ou demanda de suporte.", aliases: ["chamado", "ticket", "suporte"] },
  { type: "Defect", label: "Defeito", group: "quality", color: "#be123c", description: "Bug, defeito ou falha rastreada.", aliases: ["bug", "defeito", "falha"] },
  { type: "StoredTestCase", label: "Caso armazenado", group: "quality", color: "#16a34a", description: "Caso de teste persistido no repositorio interno.", aliases: ["caso", "teste", "cenario"] },
  { type: "TestCase", label: "Caso de teste", group: "quality", color: "#16a34a", description: "Caso manual ou automatizado de validacao.", aliases: ["caso", "teste", "cenario"] },
  { type: "TestPlan", label: "Plano de teste", group: "quality", color: "#15803d", description: "Plano, campanha ou conjunto de casos.", aliases: ["plano", "campanha"] },
  { type: "TestPlanItem", label: "Item de plano", group: "quality", color: "#22c55e", description: "Item/caso dentro de um plano de teste.", aliases: ["item", "caso do plano"] },
  { type: "ManualTestPlan", label: "Plano manual", group: "quality", color: "#166534", description: "Plano manual de testes mantido na plataforma.", aliases: ["plano manual", "manual"] },
  { type: "TestRun", label: "Execucao", group: "quality", color: "#0891b2", description: "Execucao de teste, suite ou run.", aliases: ["run", "execucao", "suite"] },
  { type: "TestRunResult", label: "Resultado de run", group: "quality", color: "#06b6d4", description: "Resultado individual produzido por uma execucao de teste.", aliases: ["resultado", "evidencia", "run result"] },
  { type: "QualityControlTestPolicy", label: "Politica de qualidade", group: "quality", color: "#0369a1", description: "Politica operacional que governa testes, CI ou qualidade.", aliases: ["politica", "ci", "qualidade"] },
  { type: "QualityAlert", label: "Alerta de qualidade", group: "quality", color: "#f97316", description: "Alerta, risco ou sinal operacional de qualidade.", aliases: ["alerta", "risco", "qualidade"] },
  { type: "Release", label: "Release", group: "delivery", color: "#4f46e5", description: "Release, entrega ou versao sincronizada.", aliases: ["release", "versao", "entrega"] },
  { type: "ReleaseManual", label: "Release manual", group: "delivery", color: "#6366f1", description: "Release manual criada na plataforma.", aliases: ["release manual"] },
  { type: "ReleaseCase", label: "Caso de release", group: "delivery", color: "#4338ca", description: "Caso associado a uma release.", aliases: ["caso de release"] },
  { type: "Screen", label: "Tela", group: "system", color: "#0d9488", description: "Tela navegavel da aplicacao.", aliases: ["tela", "pagina", "rota"] },
  { type: "ApiEndpoint", label: "Endpoint", group: "system", color: "#0284c7", description: "Endpoint HTTP interno ou API da plataforma.", aliases: ["api", "endpoint", "rota api"] },
  { type: "DataModel", label: "Modelo de dados", group: "system", color: "#475569", description: "Modelo Prisma ou entidade persistida.", aliases: ["modelo", "tabela", "banco"] },
  { type: "Component", label: "Componente", group: "system", color: "#0891b2", description: "Componente React ou elemento reutilizavel da interface.", aliases: ["componente", "ui"] },
  { type: "Service", label: "Servico", group: "system", color: "#64748b", description: "Servico, utilitario ou regra de suporte.", aliases: ["servico", "codigo"] },
  { type: "BrainService", label: "Servico Brain", group: "system", color: "#1e40af", description: "Servico interno do Brain.", aliases: ["brain service"] },
  { type: "PermissionService", label: "Servico de permissao", group: "access", color: "#6d28d9", description: "Servico que calcula ou aplica RBAC.", aliases: ["permissao", "rbac"] },
  { type: "AssistantTool", label: "Ferramenta assistente", group: "system", color: "#0f766e", description: "Ferramenta executavel pelo Brain Assistente.", aliases: ["tool", "ferramenta"] },
  { type: "Hook", label: "Hook", group: "system", color: "#0369a1", description: "Hook React ou bridge de estado.", aliases: ["hook"] },
  { type: "ContextProvider", label: "Provider", group: "system", color: "#0f766e", description: "Provider de contexto da aplicacao.", aliases: ["provider", "contexto"] },
  { type: "Store", label: "Store", group: "system", color: "#52525b", description: "Store ou repositorio de dados local.", aliases: ["store", "repositorio de dados"] },
  { type: "TypeDefinition", label: "Tipo", group: "system", color: "#71717a", description: "Contrato TypeScript compartilhado.", aliases: ["tipo", "interface"] },
  { type: "Document", label: "Documento", group: "knowledge", color: "#ca8a04", description: "Documento, manual, evidencia ou conhecimento escrito.", aliases: ["documento", "manual", "wiki"] },
  { type: "CompanyDocument", label: "Documento da empresa", group: "knowledge", color: "#ca8a04", description: "Documento vinculado a uma empresa.", aliases: ["documento", "arquivo", "manual"] },
  { type: "WikiCategory", label: "Categoria wiki", group: "knowledge", color: "#a16207", description: "Categoria de documentacao/wiki.", aliases: ["wiki", "categoria"] },
  { type: "WikiDoc", label: "Documento wiki", group: "knowledge", color: "#b45309", description: "Pagina de documentacao/wiki.", aliases: ["wiki", "documentacao", "pagina"] },
  { type: "Note", label: "Nota", group: "knowledge", color: "#b45309", description: "Nota ou memoria auxiliar.", aliases: ["nota", "memoria"] },
  { type: "Integration", label: "Integracao", group: "operations", color: "#db2777", description: "Integracao externa, provedor, webhook ou ferramenta.", aliases: ["integracao", "provider", "webhook"] },
  { type: "Dashboard", label: "Dashboard", group: "operations", color: "#059669", description: "Indicador, painel ou visao operacional.", aliases: ["dashboard", "indicador", "metrica"] },
  { type: "Repository", label: "Repositorio", group: "delivery", color: "#334155", description: "Repositorio, branch, commit ou pull request.", aliases: ["repositorio", "commit", "pr"] },
  { type: "Workflow", label: "Workflow", group: "business", color: "#d97706", description: "Fluxo de negocio, status ou automacao de decisao.", aliases: ["workflow", "fluxo", "status"] },
  { type: "Module", label: "Modulo", group: "system", color: "#1d4ed8", description: "Modulo funcional da plataforma.", aliases: ["modulo", "area"] },
  { type: "Submodule", label: "Submodulo", group: "system", color: "#3b82f6", description: "Recorte funcional dentro de um modulo.", aliases: ["submodulo"] },
];

export const BRAIN_GRAPH_EDGE_TYPES: BrainGraphEdgeDefinition[] = [
  { type: "BELONGS_TO", label: "Pertence a", description: "Liga uma entidade ao seu contexto dono." },
  { type: "MEMBER_OF", label: "Membro de", description: "Liga usuario e empresa." },
  { type: "HAS_PROFILE", label: "Tem perfil", description: "Liga usuario ao perfil efetivo." },
  { type: "GRANTS_MODULE_ACCESS", label: "Concede modulo", description: "Liga perfil aos modulos permitidos." },
  { type: "GRANTS_ACTION", label: "Concede acao", description: "Liga perfil as acoes efetivas de permissao." },
  { type: "GOVERNS_ACCESS", label: "Governa acesso", description: "Liga modulos de sistema ao catalogo RBAC." },
  { type: "CALLS_API", label: "Chama API", description: "Liga tela ou codigo ao endpoint chamado." },
  { type: "USES_MODEL", label: "Usa modelo", description: "Liga codigo, tela ou endpoint ao modelo de dados." },
  { type: "USES_CODE", label: "Usa codigo", description: "Liga artefatos por dependencia de import." },
  { type: "DOCUMENTED_BY", label: "Documentado por", description: "Liga entidades a documentos e memoria." },
  { type: "FOUND_IN_RELEASE", label: "Encontrado em release", description: "Liga defeitos e releases." },
];

const definitionsByType = new Map(BRAIN_GRAPH_NODE_TYPES.map((definition) => [definition.type, definition]));

export const BRAIN_GRAPH_NODE_COLORS = Object.fromEntries(
  BRAIN_GRAPH_NODE_TYPES.map((definition) => [definition.type, definition.color]),
) as Record<string, string>;

export function getBrainGraphNodeDefinition(type: string) {
  return definitionsByType.get(type) ?? null;
}

export function getBrainGraphNodeColor(type: string) {
  return definitionsByType.get(type)?.color ?? "#64748b";
}

export function listBrainGraphFilterOptions() {
  return BRAIN_GRAPH_NODE_TYPES.map(({ type, label, group, color }) => ({ type, label, group, color }));
}
