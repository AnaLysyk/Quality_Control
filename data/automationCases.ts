import { AUTOMATION_STUDIO_ASSETS, AUTOMATION_STUDIO_BLUEPRINTS } from "@/data/automationStudio";

export type AutomationCaseSource = "manual" | "qase" | "catalog";
export type AutomationCaseStatus = "draft" | "ready" | "automated" | "review";
export type AutomationCasePriority = "critical" | "high" | "medium";
export type AutomationCaseCoverage = "manual" | "automation" | "hybrid";

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
  externalCaseRef: string | null;
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
    summary: "Valida o cenário principal de digital e face com controle de retry e evidência final.",
    objective: objectiveForFlow("griaule-biometrics"),
    expectedResult: "GET inicial, PUT biométrico e GET final concluídos com sincronismo e evidência salva.",
    flowId: "griaule-biometrics",
    scriptTemplateId: "conditional-loop",
    source: "manual",
    status: "ready",
    priority: "critical",
    coverage: "hybrid",
    linkedPlanName: "Plano biometria Smart",
    externalCaseRef: null,
    preconditions: ["Empresa selecionada", "Processo disponível para anexar biometria", "Digital e face na biblioteca da empresa"],
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
    objective: "Evitar falha silenciosa por payload inválido e registrar fallback operacional antes do PUT.",
    expectedResult: "Fluxo entra em retry controlado ou bloqueia o envio com diagnóstico claro.",
    flowId: "griaule-biometrics",
    scriptTemplateId: "conditional-loop",
    source: "qase",
    status: "review",
    priority: "high",
    coverage: "automation",
    linkedPlanName: "Regressão biometria",
    externalCaseRef: "QASE-481",
    preconditions: ["Processo válido", "Imagem acima do limite ou com risco de overflow", "Log técnico habilitado para suporte"],
    inputBindings: ["payload.processId", "payload.mode", "asset.fingerprintBase64"],
    tags: ["base64", "retry", "smart", "diagnóstico"],
    assetIds: assetsForFlow("griaule-biometrics", 2),
  },
  {
    id: "case-cpf-rfb-ok",
    title: "Consultar CPF com retorno válido",
    application: "RFB / BCadastro",
    domain: "Consulta",
    summary: "Substitui a chamada manual por um caso objetivo com massa, validação e histórico.",
    objective: objectiveForFlow("cpf-rfb"),
    expectedResult: "Consulta responde 200 com normalização do CPF e resultado legível para a equipe.",
    flowId: "cpf-rfb",
    scriptTemplateId: "playwright-api",
    source: "catalog",
    status: "automated",
    priority: "high",
    coverage: "automation",
    linkedPlanName: null,
    externalCaseRef: null,
    preconditions: ["Ambiente liberado", "CPF de sandbox válido"],
    inputBindings: ["payload.cpf"],
    tags: ["cpf", "rfb", "smoke"],
    assetIds: [],
  },
  {
    id: "case-token-processo",
    title: "Emitir token e consultar processo",
    application: "Core Processos",
    domain: "Sessão",
    summary: "Amarra autenticação técnica e leitura de processo sem depender de Postman.",
    objective: objectiveForFlow("token-processo"),
    expectedResult: "Token emitido, consulta executada e resumo do processo salvo na execução.",
    flowId: "token-processo",
    scriptTemplateId: "playwright-api",
    source: "manual",
    status: "ready",
    priority: "medium",
    coverage: "hybrid",
    linkedPlanName: "Smoke operacional",
    externalCaseRef: null,
    preconditions: ["Credencial técnica válida", "Processo conhecido para leitura"],
    inputBindings: ["environment.id", "payload.processId"],
    tags: ["token", "processo", "smoke"],
    assetIds: [],
  },
  {
    id: "case-smart-cadastro-anexos",
    title: "Cadastrar ficha com anexos visuais",
    application: "Smart",
    domain: "Fluxo visual",
    summary: "Cobertura do cenário de UI com login, anexos, validação e evidência no navegador.",
    objective: objectiveForFlow("smart-browser"),
    expectedResult: "Login concluído, anexos enviados e mensagem de sucesso exibida no final do fluxo.",
    flowId: "smart-browser",
    scriptTemplateId: "playwright-pom",
    source: "manual",
    status: "draft",
    priority: "critical",
    coverage: "hybrid",
    linkedPlanName: "Cadastro Smart",
    externalCaseRef: null,
    preconditions: ["Usuário habilitado no Smart", "Assets disponíveis para foto e documento", "Ambiente com UI acessível"],
    inputBindings: ["payload.user", "payload.cpf", "asset.foto-perfil", "asset.documento-frente"],
    tags: ["smart", "playwright", "upload", "cadastro"],
    assetIds: assetsForFlow("smart-browser"),
  },
  {
    id: "case-smart-upload-paralelo",
    title: "Sincronizar uploads paralelos",
    application: "Smart",
    domain: "Fluxo visual",
    summary: "Valida anexos múltiplos sem travar a sequência final de validação.",
    objective: "Executar uploads paralelos e confirmar sincronização antes do assert final.",
    expectedResult: "Todos os anexos terminam antes da mensagem final e a execução mantém rastreabilidade.",
    flowId: "smart-browser",
    scriptTemplateId: "parallel-upload",
    source: "catalog",
    status: "ready",
    priority: "high",
    coverage: "automation",
    linkedPlanName: null,
    externalCaseRef: null,
    preconditions: ["Arquivos de teste carregados", "Fluxo configurado para anexos múltiplos"],
    inputBindings: ["assets.documents"],
    tags: ["smart", "upload", "paralelo"],
    assetIds: assetsForFlow("smart-browser"),
  },
];

