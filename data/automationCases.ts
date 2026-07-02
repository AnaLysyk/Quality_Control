import { AUTOMATION_STUDIO_ASSETS, AUTOMATION_STUDIO_BLUEPRINTS } from "@/data/automationStudio";
import type { AutomationCompanyScope } from "@/lib/automations/companyScope";

export type AutomationCaseSource = "manual" | "qase" | "catalog";
export type AutomationCaseStatus = "draft" | "ready" | "automated" | "review";
export type AutomationCasePriority = "critical" | "high" | "medium";
export type AutomationCaseCoverage = "manual" | "automation" | "hybrid";
export type AutomationCaseExecutionStatus = "passed" | "failed" | "blocked" | "not_run";

export type AutomationCaseDefinition = {
  id: string;
  title: string;
  application: string;
  domain: string;
  summary: string;
  objective: string;
  expectedResult: string;
  flowId: string;
  scriptTemplateId: string;
  source: AutomationCaseSource;
  status: AutomationCaseStatus;
  priority: AutomationCasePriority;
  coverage: AutomationCaseCoverage;
  linkedPlanName: string | null;
  linkedRunName?: string | null;
  playwrightSpecPath?: string | null;
  lastExecutionStatus?: AutomationCaseExecutionStatus | null;
  lastExecutionAt?: string | null;
  externalCaseRef: string | null;
  companyScope: AutomationCompanyScope;
  preconditions: string[];
  inputBindings: string[];
  tags: string[];
  assetIds: string[];
};

const flowAssets = new Map<string, string[]>();
for (const asset of AUTOMATION_STUDIO_ASSETS) {
  for (const flowId of asset.flowIds) {
    const current = flowAssets.get(flowId) ?? [];
    flowAssets.set(flowId, [...current, asset.id]);
  }
}

function assetsForFlow(flowId: string, limit = 3) {
  return (flowAssets.get(flowId) ?? []).slice(0, limit);
}

function objectiveForFlow(flowId: string) {
  return AUTOMATION_STUDIO_BLUEPRINTS.find((flow) => flow.id === flowId)?.objective ?? "Caso operacional configurado no painel.";
}

export const AUTOMATION_CASES: AutomationCaseDefinition[] = [
  {
    id: "case-griaule-completo",
    title: "Anexar biometria completa no Smart",
    application: "Smart / Griaule",
    domain: "Biometria",
    summary: "Valida o cenÃ¡rio principal de digital e face com controle de retry e evidÃªncia final.",
    objective: objectiveForFlow("griaule-biometrics"),
    expectedResult: "GET inicial, PUT biomÃ©trico e GET final concluÃ­dos com sincronismo e evidÃªncia salva.",
    flowId: "griaule-biometrics",
    scriptTemplateId: "conditional-loop",
    source: "manual",
    status: "ready",
    priority: "critical",
    coverage: "hybrid",
    linkedPlanName: "Plano biometria Smart",
    linkedRunName: "Run biometria Smart - regressao",
    playwrightSpecPath: "tests-e2e/biometrics-smoke.spec.ts",
    lastExecutionStatus: "not_run",
    lastExecutionAt: null,
    externalCaseRef: null,
    companyScope: "griaule",
    preconditions: ["Empresa selecionada", "Processo disponÃ­vel para anexar biometria", "Digital e face na biblioteca da empresa"],
    inputBindings: ["payload.processId", "asset.anelar-esquerdo", "asset.face"],
    tags: ["smart", "biometria", "face", "digital"],
    assetIds: assetsForFlow("griaule-biometrics"),
  },
  {
    id: "case-griaule-limite-base64",
    title: "Controlar limite Base64 antes do PUT",
    application: "Smart / Griaule",
    domain: "Biometria",
    summary: "Garante que o fluxo trate payload grande antes de enviar a biometria final.",
    objective: "Evitar falha silenciosa por payload invÃ¡lido e registrar fallback operacional antes do PUT.",
    expectedResult: "Fluxo entra em retry controlado ou bloqueia o envio com diagnÃ³stico claro.",
    flowId: "griaule-biometrics",
    scriptTemplateId: "conditional-loop",
    source: "qase",
    status: "review",
    priority: "high",
    coverage: "automation",
    linkedPlanName: "RegressÃ£o biometria",
    linkedRunName: "Run biometria Smart - base64",
    playwrightSpecPath: "tests-e2e/biometrics-base64.spec.ts",
    lastExecutionStatus: "not_run",
    lastExecutionAt: null,
    externalCaseRef: "QASE-481",
    companyScope: "griaule",
    preconditions: ["Processo vÃ¡lido", "Imagem acima do limite ou com risco de overflow", "Log tÃ©cnico habilitado para suporte"],
    inputBindings: ["payload.processId", "payload.mode", "asset.fingerprintBase64"],
    tags: ["base64", "retry", "smart", "diagnÃ³stico"],
    assetIds: assetsForFlow("griaule-biometrics", 2),
  },
  {
    id: "case-cpf-rfb-ok",
    title: "Consultar CPF com retorno vÃ¡lido",
    application: "RFB / BCadastro",
    domain: "Consulta",
    summary: "Substitui a chamada manual por um caso objetivo com massa, validaÃ§Ã£o e histÃ³rico.",
    objective: objectiveForFlow("cpf-rfb"),
    expectedResult: "Consulta responde 200 com normalizaÃ§Ã£o do CPF e resultado legÃ­vel para a equipe.",
    flowId: "cpf-rfb",
    scriptTemplateId: "playwright-api",
    source: "catalog",
    status: "automated",
    priority: "high",
    coverage: "automation",
    linkedPlanName: null,
    linkedRunName: "Run API RFB - smoke",
    playwrightSpecPath: "tests-e2e/cpf-rfb.spec.ts",
    lastExecutionStatus: "not_run",
    lastExecutionAt: null,
    externalCaseRef: null,
    companyScope: "griaule",
    preconditions: ["Ambiente liberado", "CPF de sandbox vÃ¡lido"],
    inputBindings: ["payload.cpf"],
    tags: ["cpf", "rfb", "smoke"],
    assetIds: [],
  },
  {
    id: "case-token-processo",
    title: "Emitir token e consultar processo",
    application: "Core Processos",
    domain: "SessÃ£o",
    summary: "Amarra autenticaÃ§Ã£o tÃ©cnica e leitura de processo sem depender de Postman.",
    objective: objectiveForFlow("token-processo"),
    expectedResult: "Token emitido, consulta executada e resumo do processo salvo na execuÃ§Ã£o.",
    flowId: "token-processo",
    scriptTemplateId: "playwright-api",
    source: "manual",
    status: "ready",
    priority: "medium",
    coverage: "hybrid",
    linkedPlanName: "Smoke operacional",
    linkedRunName: "Run Core Processos - smoke",
    playwrightSpecPath: "tests-e2e/token-processo.spec.ts",
    lastExecutionStatus: "not_run",
    lastExecutionAt: null,
    externalCaseRef: null,
    companyScope: "griaule",
    preconditions: ["Credencial tÃ©cnica vÃ¡lida", "Processo conhecido para leitura"],
    inputBindings: ["environment.id", "payload.processId"],
    tags: ["token", "processo", "smoke"],
    assetIds: [],
  },
  {
    id: "case-smart-cadastro-anexos",
    title: "Cadastrar ficha com anexos visuais",
    application: "Smart",
    domain: "Fluxo visual",
    summary: "Cobertura do cenÃ¡rio de UI com login, anexos, validaÃ§Ã£o e evidÃªncia no navegador.",
    objective: objectiveForFlow("smart-browser"),
    expectedResult: "Login concluÃ­do, anexos enviados e mensagem de sucesso exibida no final do fluxo.",
    flowId: "smart-browser",
    scriptTemplateId: "playwright-pom",
    source: "manual",
    status: "draft",
    priority: "critical",
    coverage: "hybrid",
    linkedPlanName: "Cadastro Smart",
    linkedRunName: "Run Smart UI - cadastro",
    playwrightSpecPath: "tests-e2e/smart-cadastro.spec.ts",
    lastExecutionStatus: "not_run",
    lastExecutionAt: null,
    externalCaseRef: null,
    companyScope: "griaule",
    preconditions: ["UsuÃ¡rio habilitado no Smart", "Assets disponÃ­veis para foto e documento", "Ambiente com UI acessÃ­vel"],
    inputBindings: ["payload.user", "payload.cpf", "asset.foto-perfil", "asset.documento-frente"],
    tags: ["smart", "playwright", "upload", "cadastro"],
    assetIds: assetsForFlow("smart-browser"),
  },
  {
    id: "case-smart-upload-paralelo",
    title: "Sincronizar uploads paralelos",
    application: "Smart",
    domain: "Fluxo visual",
    summary: "Valida anexos mÃºltiplos sem travar a sequÃªncia final de validaÃ§Ã£o.",
    objective: "Executar uploads paralelos e confirmar sincronizaÃ§Ã£o antes do assert final.",
    expectedResult: "Todos os anexos terminam antes da mensagem final e a execuÃ§Ã£o mantÃ©m rastreabilidade.",
    flowId: "smart-browser",
    scriptTemplateId: "parallel-upload",
    source: "catalog",
    status: "ready",
    priority: "high",
    coverage: "automation",
    linkedPlanName: null,
    linkedRunName: "Run Smart UI - uploads",
    playwrightSpecPath: "tests-e2e/smart-upload.spec.ts",
    lastExecutionStatus: "not_run",
    lastExecutionAt: null,
    externalCaseRef: null,
    companyScope: "griaule",
    preconditions: ["Arquivos de teste carregados", "Fluxo configurado para anexos mÃºltiplos"],
    inputBindings: ["assets.documents"],
    tags: ["smart", "upload", "paralelo"],
    assetIds: assetsForFlow("smart-browser"),
  },
  {
    id: "case-qc-automation-fab-menu",
    title: "Abrir dashboard admin do Painel QA",
    application: "Quality Control",
    domain: "Smoke de tela",
    summary: "Valida a abertura do dashboard administrativo com sessÃ£o autenticada e sem quebra visual inicial.",
    objective: objectiveForFlow("qc-admin-dashboard"),
    expectedResult: "Dashboard responde autenticado, sem redirecionar para login, com shell e busca da empresa disponÃ­veis.",
    flowId: "qc-admin-dashboard",
    scriptTemplateId: "playwright-pom",
    source: "catalog",
    status: "ready",
    priority: "critical",
    coverage: "automation",
    linkedPlanName: "Painel QA Smoke",
    linkedRunName: "Run Painel QA - smoke",
    playwrightSpecPath: "tests-e2e/smoke.spec.ts",
    lastExecutionStatus: "passed",
    lastExecutionAt: "2026-05-07T00:00:00.000Z",
    externalCaseRef: null,
    companyScope: "testing-company",
    preconditions: ["SessÃ£o autenticada", "Perfil Testing Company ativo"],
    inputBindings: ["environment.baseUrl", "session.cookies"],
    tags: ["painel", "dashboard", "smoke"],
    assetIds: [],
  },
  {
    id: "case-qc-automation-breadcrumb-back",
    title: "Abrir QA IDE e renderizar ferramentas",
    application: "Quality Control",
    domain: "AutomaÃ§Ã£o",
    summary: "Confirma que a nova shell de automaÃ§Ã£o abre no contexto da Testing Company e exibe os mÃ³dulos principais.",
    objective: objectiveForFlow("qc-automation-ide"),
    expectedResult: "PÃ¡gina de automaÃ§Ãµes responde com QA IDE, navegaÃ§Ã£o lateral e cards do workspace.",
    flowId: "qc-automation-ide",
    scriptTemplateId: "playwright-pom",
    source: "catalog",
    status: "ready",
    priority: "high",
    coverage: "automation",
    linkedPlanName: "Painel QA Smoke",
    linkedRunName: "Run Painel QA - automacoes",
    playwrightSpecPath: "tests-e2e/automation-studio.spec.ts",
    lastExecutionStatus: "passed",
    lastExecutionAt: "2026-05-07T00:00:00.000Z",
    externalCaseRef: null,
    companyScope: "testing-company",
    preconditions: ["SessÃ£o autenticada", "MÃ³dulo de automaÃ§Ã£o habilitado"],
    inputBindings: ["environment.baseUrl"],
    tags: ["painel", "automacao", "ide"],
    assetIds: [],
  },
  {
    id: "case-qc-automation-cards-width",
    title: "Abrir home institucional da empresa",
    application: "Quality Control",
    domain: "Empresa",
    summary: "Garante que a home da empresa Testing Company continua separada do dashboard e carregando corretamente.",
    objective: objectiveForFlow("qc-company-home"),
    expectedResult: "Home da empresa abre com contexto ativo, atalhos principais e sem redirecionamento inesperado.",
    flowId: "qc-company-home",
    scriptTemplateId: "playwright-pom",
    source: "catalog",
    status: "ready",
    priority: "high",
    coverage: "automation",
    linkedPlanName: "Painel QA Smoke",
    linkedRunName: "Run Painel QA - empresa",
    playwrightSpecPath: "tests-e2e/happy-path.spec.ts",
    lastExecutionStatus: "passed",
    lastExecutionAt: "2026-05-07T00:00:00.000Z",
    externalCaseRef: null,
    companyScope: "testing-company",
    preconditions: ["Empresa Testing Company ativa", "SessÃ£o autenticada"],
    inputBindings: ["payload.companySlug"],
    tags: ["painel", "empresa", "home"],
    assetIds: [],
  },
  {
    id: "case-qc-automation-detail-actions",
    title: "Abrir runs da empresa e listar execuÃ§Ãµes",
    application: "Quality Control",
    domain: "Runs",
    summary: "Valida a tela de runs da Testing Company e a leitura operacional bÃ¡sica da lista.",
    objective: objectiveForFlow("qc-company-runs"),
    expectedResult: "Tela de runs abre autenticada, renderiza listagem e mantÃ©m o filtro operacional acessÃ­vel.",
    flowId: "qc-company-runs",
    scriptTemplateId: "playwright-pom",
    source: "catalog",
    status: "ready",
    priority: "medium",
    coverage: "automation",
    linkedPlanName: "Painel QA Smoke",
    linkedRunName: "Run Painel QA - runs",
    playwrightSpecPath: "tests-e2e/runs-quality.spec.ts",
    lastExecutionStatus: "passed",
    lastExecutionAt: "2026-05-07T00:00:00.000Z",
    externalCaseRef: null,
    companyScope: "testing-company",
    preconditions: ["Empresa Testing Company ativa", "SessÃ£o autenticada"],
    inputBindings: ["payload.companySlug"],
    tags: ["painel", "runs", "smoke"],
    assetIds: [],
  },
];

