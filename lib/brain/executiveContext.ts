import type { BrainAccessContext } from "./access";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";
import { canAccessRoute } from "@/lib/permissions/can-access";

export type ExecutiveBrainNode = {
  id: string;
  label: string;
  type: string;
  refType: string | null;
  refId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  isRoot?: boolean;
};

export type ExecutiveBrainEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  metadata: Record<string, unknown>;
};

type ExecutiveNodeInput = {
  id: string;
  label: string;
  type: string;
  description: string;
  route: string;
  profiles: string[];
  prompts: string[];
  action: string;
  layer: "executive" | "company" | "project" | "quality" | "governance" | "assistant";
};

const EXECUTIVE_NODE_DEFS: ExecutiveNodeInput[] = [
  {
    id: "exec-root",
    label: "VisÃ£o Geral TC",
    type: "ExecutiveControlTower",
    description: "NÃ³ raiz da gestÃ£o consultiva da Testing Company: carteira de empresas, saÃºde da qualidade, risco e prioridade de atuaÃ§Ã£o.",
    route: "/dashboard",
    profiles: ["leader_tc", "technical_support"],
    action: "Abrir painel executivo da carteira",
    layer: "executive",
    prompts: [
      "Quais empresas estÃ£o crÃ­ticas agora?",
      "Qual Ã© a prioridade consultiva da semana?",
      "Resuma a saÃºde da carteira para uma reuniÃ£o executiva.",
    ],
  },
  {
    id: "exec-companies",
    label: "Empresas atendidas",
    type: "CompanyPortfolio",
    description: "Carteira de clientes/empresas acompanhadas pela Testing Company, com acesso para dashboard, projetos e operaÃ§Ã£o por empresa.",
    route: "/admin/clients",
    profiles: ["leader_tc", "technical_support"],
    action: "Abrir carteira de empresas",
    layer: "company",
    prompts: ["Liste empresas sem execuÃ§Ã£o", "Mostre empresas com maior risco", "Me ajude a priorizar atendimento por cliente."],
  },
  {
    id: "exec-projects",
    label: "Projetos e operaÃ§Ãµes",
    type: "ProjectOperations",
    description: "Cada aplicaÃ§Ã£o/projeto vira uma operaÃ§Ã£o prÃ³pria de qualidade com dashboard, casos, defeitos, planos, runs e documentos.",
    route: "/empresas/[slug]/projetos",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user"],
    action: "Abrir projetos da empresa selecionada",
    layer: "project",
    prompts: ["Quais projetos nÃ£o tÃªm casos?", "Quais projetos estÃ£o sem runs?", "Explique o escopo operacional desse projeto."],
  },
  {
    id: "exec-test-cases",
    label: "RepositÃ³rio de Casos",
    type: "TestCaseRepository",
    description: "Fonte oficial dos casos manuais, importados, integrados e automatizados. Suporta importaÃ§Ã£o/exportaÃ§Ã£o PDF, CSV, JSON e Excel.",
    route: "/casos-de-teste",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir repositÃ³rio de casos",
    layer: "quality",
    prompts: ["Mostre lacunas de cobertura", "Gere casos para esse fluxo", "Explique campos no padrÃ£o Qase opcional."],
  },
  {
    id: "exec-defects",
    label: "Defeitos",
    type: "DefectManagement",
    description: "GestÃ£o de bugs, severidade, risco, status e impacto por empresa/projeto para atuaÃ§Ã£o de QA e suporte tÃ©cnico.",
    route: "/empresas/[slug]/defeitos",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user"],
    action: "Abrir defeitos do contexto",
    layer: "quality",
    prompts: ["Quais defeitos bloqueiam a operaÃ§Ã£o?", "Monte um resumo executivo dos bugs", "Sugira prÃ³xima aÃ§Ã£o por severidade."],
  },
  {
    id: "exec-test-plans",
    label: "Planos de Teste",
    type: "TestPlanManagement",
    description: "Planejamento de ciclos, escopo, critÃ©rios de aceite e organizaÃ§Ã£o dos casos por projeto.",
    route: "/empresas/[slug]/planos-de-teste",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir planos de teste",
    layer: "quality",
    prompts: ["Monte plano de regressÃ£o", "Quais planos estÃ£o sem execuÃ§Ã£o?", "O plano cobre os riscos principais?"],
  },
  {
    id: "exec-runs",
    label: "Runs e execuÃ§Ãµes",
    type: "RunManagement",
    description: "ExecuÃ§Ãµes manuais e automatizadas, resultados, falhas, bloqueios e rastreabilidade dos ciclos de qualidade.",
    route: "/empresas/[slug]/runs",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir runs do contexto",
    layer: "quality",
    prompts: ["Explique falhas recentes", "Qual run precisa de reexecuÃ§Ã£o?", "Calcule risco do ciclo atual."],
  },
  {
    id: "exec-qase",
    label: "IntegraÃ§Ã£o Qase",
    type: "QaseIntegration",
    description: "ReferÃªncia opcional para projetos, suites e casos integrados. MantÃ©m rastreabilidade sem prender o sistema ao Qase.",
    route: "/integracoes",
    profiles: ["leader_tc", "technical_support"],
    action: "Ver integraÃ§Ãµes configuradas",
    layer: "governance",
    prompts: ["Quais projetos vÃªm do Qase?", "Explique o vÃ­nculo Qase opcional", "Como validar importaÃ§Ã£o/exportaÃ§Ã£o?"],
  },
  {
    id: "exec-permissions",
    label: "Perfis e permissÃµes",
    type: "ProfileGovernance",
    description: "GovernanÃ§a de acesso por perfil: LÃ­der TC, Suporte TÃ©cnico, Empresa, UsuÃ¡rio da empresa e UsuÃ¡rio TC.",
    route: "/admin/users/permissions",
    profiles: ["leader_tc", "technical_support"],
    action: "Abrir gestÃ£o de perfis",
    layer: "governance",
    prompts: ["Explique o que cada perfil pode acessar", "Valide se empresa vÃª sÃ³ seu contexto", "Qual perfil deve resolver esse caso?"],
  },
  {
    id: "exec-chat-profiles",
    label: "Chat por perfil",
    type: "AssistantProfileContext",
    description: "Assistente contextual para todos os perfis, respeitando RBAC e ajudando conforme tela, empresa, projeto e papel do usuÃ¡rio.",
    route: "global-assistant",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir assistente contextual",
    layer: "assistant",
    prompts: ["O que eu posso fazer aqui?", "Me ajuda com meu perfil", "Explique a tela e prÃ³ximos passos."],
  },
  {
    id: "exec-brain",
    label: "Brain contextual",
    type: "BrainKnowledgeMap",
    description: "Mapa vivo com nÃ³s de produto, empresa, projeto, QA, automaÃ§Ã£o, defeitos, runs, permissÃµes e decisÃµes.",
    route: "/admin/sistema/mapa",
    profiles: ["leader_tc", "technical_support"],
    action: "Abrir mapa do Brain",
    layer: "assistant",
    prompts: ["Mostre relaÃ§Ãµes desse mÃ³dulo", "Explique esse nÃ³", "Quais lacunas de conhecimento existem?"],
  },
];

const EXECUTIVE_EDGES: Array<[string, string, string]> = [
  ["exec-root", "exec-companies", "governa"],
  ["exec-root", "exec-projects", "organiza"],
  ["exec-root", "exec-test-cases", "mede-cobertura"],
  ["exec-root", "exec-defects", "prioriza-risco"],
  ["exec-root", "exec-test-plans", "planeja"],
  ["exec-root", "exec-runs", "acompanha"],
  ["exec-projects", "exec-test-cases", "escopa"],
  ["exec-projects", "exec-defects", "isola-risco"],
  ["exec-test-plans", "exec-runs", "executa"],
  ["exec-runs", "exec-defects", "gera-evidencia"],
  ["exec-qase", "exec-test-cases", "sincroniza"],
  ["exec-permissions", "exec-chat-profiles", "contextualiza"],
  ["exec-brain", "exec-chat-profiles", "alimenta"],
  ["exec-brain", "exec-root", "explica"],
];

function canSeeNode(node: ExecutiveNodeInput, access: BrainAccessContext) {
  const roles = [access.user.permissionRole, access.user.companyRole, access.user.role]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
  const hasProfileAccess = access.hasGlobalVisibility || node.profiles.some((profile) => roles.includes(profile));
  if (!hasProfileAccess) return false;

  const routeDefinition = SYSTEM_ROUTES.find((route) => route.path.split("?")[0] === node.route.split("?")[0]);
  return routeDefinition ? canAccessRoute(access.userAccess, routeDefinition) : true;
}

export function getExecutiveBrainContextGraph(access: BrainAccessContext) {
  const visibleDefs = EXECUTIVE_NODE_DEFS.filter((node) => canSeeNode(node, access));
  const visibleIds = new Set(visibleDefs.map((node) => node.id));

  const nodes: ExecutiveBrainNode[] = visibleDefs.map((node) => ({
    id: node.id,
    label: node.label,
    type: node.type,
    refType: "ExecutiveContext",
    refId: node.id,
    description: node.description,
    isRoot: node.id === "exec-root",
    metadata: {
      virtual: true,
      layer: node.layer,
      route: node.route,
      action: node.action,
      profiles: node.profiles,
      suggestedPrompts: node.prompts,
      companySlug: access.allowedCompanySlugs.size === 1 ? Array.from(access.allowedCompanySlugs)[0] : null,
      screenSummary: node.description,
    },
  }));

  const edges: ExecutiveBrainEdge[] = EXECUTIVE_EDGES
    .filter(([source, target]) => visibleIds.has(source) && visibleIds.has(target))
    .map(([source, target, type]) => ({
      id: `exec-edge-${source}-${target}`,
      source,
      target,
      type,
      weight: 1,
      metadata: { virtual: true, executive: true },
    }));

  return { nodes, edges };
}

