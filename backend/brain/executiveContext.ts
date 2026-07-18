import type { BrainAccessContext } from "./access";
import { SYSTEM_ROUTES } from "@/backend/navigation/route-map";
import { canAccessRoute } from "@/backend/permissions/can-access";

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
    id: "exec-companies",
    label: "Empresas atendidas",
    type: "CompanyPortfolio",
    description: "Carteira de clientes/empresas acompanhadas pela Testing Company, com acesso para dashboard, projetos e operação por empresa.",
    route: "/admin/clients",
    profiles: ["leader_tc", "technical_support"],
    action: "Abrir carteira de empresas",
    layer: "company",
    prompts: ["Liste empresas sem execução", "Mostre empresas com maior risco", "Me ajude a priorizar atendimento por cliente."],
  },
  {
    id: "exec-projects",
    label: "Projetos e operações",
    type: "ProjectOperations",
    description: "Cada aplicação/projeto vira uma operação própria de qualidade com dashboard, casos, defeitos, planos, runs e documentos.",
    route: "/empresas/[slug]/projetos",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user"],
    action: "Abrir projetos da empresa selecionada",
    layer: "project",
    prompts: ["Quais projetos não têm casos?", "Quais projetos estão sem runs?", "Explique o escopo operacional desse projeto."],
  },
  {
    id: "exec-test-cases",
    label: "Repositório de Casos",
    type: "TestCaseRepository",
    description: "Fonte oficial dos casos manuais, importados, integrados e automatizados. Suporta importação/exportação PDF, CSV, JSON e Excel.",
    route: "/casos-de-teste",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir repositório de casos",
    layer: "quality",
    prompts: ["Mostre lacunas de cobertura", "Gere casos para esse fluxo", "Explique campos no padrão Qase opcional."],
  },
  {
    id: "exec-defects",
    label: "Defeitos",
    type: "DefectManagement",
    description: "Gestão de bugs, severidade, risco, status e impacto por empresa/projeto para atuação de QA e suporte técnico.",
    route: "/empresas/[slug]/defeitos",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user"],
    action: "Abrir defeitos do contexto",
    layer: "quality",
    prompts: ["Quais defeitos bloqueiam a operação?", "Monte um resumo executivo dos bugs", "Sugira próxima ação por severidade."],
  },
  {
    id: "exec-test-plans",
    label: "Planos de Teste",
    type: "TestPlanManagement",
    description: "Planejamento de ciclos, escopo, critérios de aceite e organização dos casos por projeto.",
    route: "/empresas/[slug]/planos-de-teste",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir planos de teste",
    layer: "quality",
    prompts: ["Monte plano de regressão", "Quais planos estão sem execução?", "O plano cobre os riscos principais?"],
  },
  {
    id: "exec-runs",
    label: "Runs e execuções",
    type: "RunManagement",
    description: "Execuções manuais e automatizadas, resultados, falhas, bloqueios e rastreabilidade dos ciclos de qualidade.",
    route: "/empresas/[slug]/runs",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir runs do contexto",
    layer: "quality",
    prompts: ["Explique falhas recentes", "Qual run precisa de reexecução?", "Calcule risco do ciclo atual."],
  },
  {
    id: "exec-qase",
    label: "Integração Qase",
    type: "QaseIntegration",
    description: "Referência opcional para projetos, suites e casos integrados. Mantém rastreabilidade sem prender o sistema ao Qase.",
    route: "/integracoes",
    profiles: ["leader_tc", "technical_support"],
    action: "Ver integrações configuradas",
    layer: "governance",
    prompts: ["Quais projetos vêm do Qase?", "Explique o vínculo Qase opcional", "Como validar importação/exportação?"],
  },
  {
    id: "exec-permissions",
    label: "Perfis e permissões",
    type: "ProfileGovernance",
    description: "Governança de acesso por perfil: Líder TC, Suporte Técnico, Empresa, Usuário da empresa e Usuário TC.",
    route: "/admin/users/permissions",
    profiles: ["leader_tc", "technical_support"],
    action: "Abrir gestão de perfis",
    layer: "governance",
    prompts: ["Explique o que cada perfil pode acessar", "Valide se empresa vê só seu contexto", "Qual perfil deve resolver esse caso?"],
  },

  {
    id: "exec-automation",
    label: "Fluxos de Automação",
    type: "AutomationFlow",
    description: "Fila, geração, revisão, publicação no GitHub, última versão conhecida e resultados das automações por projeto.",
    route: "/automacoes/playwright",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir fluxos de automação",
    layer: "quality",
    prompts: ["Quais automações estão na fila?", "Mostre a última versão conhecida", "Quais fluxos falharam recentemente?"],
  },
  {
    id: "exec-history",
    label: "Logs e Histórico",
    type: "QualityHistory",
    description: "Trilha temporal de automações, testes manuais, alterações, resultados e eventos autorizados no contexto atual.",
    route: "/admin/logs",
    profiles: ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"],
    action: "Abrir logs e histórico",
    layer: "governance",
    prompts: ["Mostre eventos recentes", "Explique a última alteração", "Quais falhas aparecem no histórico?"],
  },
  {
    id: "exec-brain",
    label: "Controle de Qualidade",
    type: "QualityControlMap",
    description: "Núcleo do mapa vivo de QA: projetos, casos, planos, execuções, automações, defeitos, logs, histórico e decisões.",
    route: "/admin/sistema/mapa",
    profiles: ["leader_tc", "technical_support"],
    action: "Abrir mapa do Brain",
    layer: "assistant",
    prompts: ["Mostre relações desse módulo", "Explique esse nó", "Quais lacunas de conhecimento existem?"],
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
  ["exec-brain", "exec-projects", "organiza-contexto"],
  ["exec-brain", "exec-test-cases", "controla-cobertura"],
  ["exec-brain", "exec-test-plans", "planeja-qualidade"],
  ["exec-brain", "exec-runs", "acompanha-execucao"],
  ["exec-brain", "exec-automation", "orquestra-automacao"],
  ["exec-brain", "exec-history", "preserva-historico"],
  ["exec-automation", "exec-runs", "gera-execucao"],
  ["exec-runs", "exec-history", "registra-resultado"],
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
    isRoot: false,
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

