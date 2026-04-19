import { BIOMETRIC_FIXTURE_DEFINITIONS } from "@/data/biometricFixtures";

export type AutomationStudioStepKind =
  | "open_page"
  | "http_request"
  | "graphql_request"
  | "fill_field"
  | "select_option"
  | "upload_file"
  | "paste_base64"
  | "wait_for_element"
  | "assert_text"
  | "capture_evidence"
  | "conditional_branch"
  | "loop_until"
  | "parallel_group"
  | "subflow_call"
  | "approval_gate"
  | "custom_script";

export type AutomationStudioRunnerType = "http" | "browser" | "hybrid";

export type AutomationStudioStepTemplate = {
  description: string;
  expectedResult: string;
  inputBinding: string;
  kind: AutomationStudioStepKind;
  selector: string;
  title: string;
};

export type AutomationStudioBlueprint = {
  defaultNotes: string;
  defaultScript: string;
  defaultStatus: "active" | "inactive";
  description: string;
  id: string;
  objective: string;
  realRunnerId: string | null;
  runnerType: AutomationStudioRunnerType;
  stack: string;
  steps: AutomationStudioStepTemplate[];
  title: string;
};

export type AutomationStudioActionPreset = {
  description: string;
  expectedResult: string;
  inputBinding: string;
  kind: AutomationStudioStepKind;
  selector: string;
  title: string;
};

export type AutomationStudioAsset = {
  category: string;
  companyScoped: boolean;
  flowIds: string[];
  id: string;
  summary: string;
  title: string;
  type: "fixture" | "file" | "payload" | "base64";
};

export type AutomationStudioScriptTemplate = {
  code: string;
  id: string;
  summary: string;
  title: string;
};

export type AutomationStudioSubflowTemplate = {
  id: string;
  steps: string[];
  summary: string;
  title: string;
};

export type AutomationStudioTriggerMode = "manual" | "webhook" | "schedule" | "file_watch";

export const AUTOMATION_STUDIO_ACTION_LIBRARY: AutomationStudioActionPreset[] = [
  {
    kind: "open_page",
    title: "Abrir página",
    selector: "https://sistema/rota",
    inputBinding: "environment.baseUrl",
    expectedResult: "A página inicial fica pronta para interação.",
    description: "Abre uma URL ou rota do ambiente configurado.",
  },
  {
    kind: "http_request",
    title: "Executar request REST",
    selector: "GET /api/recurso",
    inputBinding: "payload.processId",
    expectedResult: "Retorna 200 e corpo normalizado para a etapa seguinte.",
    description: "Dispara um endpoint com autenticação centralizada no backend.",
  },
  {
    kind: "graphql_request",
    title: "Executar GraphQL",
    selector: "query Processo($id: ID!)",
    inputBinding: "variables.processId",
    expectedResult: "Resposta mapeada para o contexto do fluxo.",
    description: "Permite consumir GraphQL e reaproveitar a resposta em outras etapas.",
  },
  {
    kind: "fill_field",
    title: "Preencher campo",
    selector: "[name='cpf']",
    inputBinding: "payload.cpf",
    expectedResult: "Campo preenchido sem erro de máscara.",
    description: "Preenche texto, número, token ou valor derivado do ambiente.",
  },
  {
    kind: "select_option",
    title: "Selecionar opção",
    selector: "[name='ambiente']",
    inputBinding: "environment.id",
    expectedResult: "Combo atualizado com o valor esperado.",
    description: "Seleciona item em combo, radio ou componente customizado.",
  },
  {
    kind: "upload_file",
    title: "Anexar arquivo",
    selector: "input[type='file']",
    inputBinding: "asset.face",
    expectedResult: "Arquivo anexado e reconhecido pelo fluxo.",
    description: "Usa arquivo local, fixture ou biblioteca de evidências da empresa.",
  },
  {
    kind: "paste_base64",
    title: "Colar base64",
    selector: "[data-field='digital']",
    inputBinding: "asset.fingerprintBase64",
    expectedResult: "Campo técnico recebe a digital codificada.",
    description: "Cenário típico para biometria, payload de imagem e integrações antigas.",
  },
  {
    kind: "wait_for_element",
    title: "Esperar elemento",
    selector: "[data-testid='success-banner']",
    inputBinding: "timeout.5000",
    expectedResult: "Elemento aparece dentro da janela configurada.",
    description: "Segura o fluxo até a aplicação estabilizar.",
  },
  {
    kind: "assert_text",
    title: "Validar texto",
    selector: "[data-testid='status']",
    inputBinding: "Sucesso",
    expectedResult: "Texto renderizado bate com o esperado.",
    description: "Garante a resposta final de negócio sem olhar só status HTTP.",
  },
  {
    kind: "conditional_branch",
    title: "Condição / if-else",
    selector: "if (context.status === 'PENDING')",
    inputBinding: "step.output",
    expectedResult: "Fluxo escolhe o próximo caminho dinamicamente.",
    description: "Controla bifurcação por payload, status, ambiente ou resultado anterior.",
  },
  {
    kind: "loop_until",
    title: "Loop / retry controlado",
    selector: "while (!result.ready)",
    inputBinding: "step.output",
    expectedResult: "Etapa repete até cumprir a condição ou atingir o limite.",
    description: "Útil para polling, tentativas adicionais e cenários assíncronos.",
  },
  {
    kind: "parallel_group",
    title: "Grupo paralelo",
    selector: "parallel(upload-docs)",
    inputBinding: "assets.documents",
    expectedResult: "Tarefas independentes terminam antes da sincronização final.",
    description: "Permite upload em massa, múltiplos requests e fan-out controlado.",
  },
  {
    kind: "subflow_call",
    title: "Chamar subfluxo",
    selector: "subflow:login-smart",
    inputBinding: "variables.auth",
    expectedResult: "Trecho reutilizável executado sem duplicar código.",
    description: "Encapsula login, navegação, tokenização e passos recorrentes.",
  },
  {
    kind: "approval_gate",
    title: "Aprovação humana",
    selector: "approve:analista-qa",
    inputBinding: "run.summary",
    expectedResult: "Fluxo pausa até aceite, ajuste ou rejeição manual.",
    description: "Usado em processos críticos, análise visual e validação sensível.",
  },
  {
    kind: "capture_evidence",
    title: "Capturar evidência",
    selector: "screen",
    inputBinding: "run.evidence",
    expectedResult: "Screenshot, payload e log ficam anexados ao histórico.",
    description: "Guarda o resultado para auditoria, debugging ou suporte.",
  },
  {
    kind: "custom_script",
    title: "Script customizado",
    selector: "stepContext",
    inputBinding: "helpers",
    expectedResult: "A etapa executa uma regra específica sem sair do front.",
    description: "Permite complementar o fluxo com JavaScript orientado a contexto.",
  },
];

export const AUTOMATION_STUDIO_BLUEPRINTS: AutomationStudioBlueprint[] = [
  {
    id: "griaule-biometrics",
    title: "Biometria Griaule",
    description: "Fluxo real para anexar digital e face com controle de limite Base64, retries e auditoria do PUT.",
    objective: "Executar GET/PUT/GET com visibilidade por empresa e preparar o runner below/above pela interface.",
    stack: "HTTP runner + fixtures locais + debug operacional",
    runnerType: "hybrid",
    realRunnerId: "griaule-biometrics",
    defaultStatus: "active",
    defaultNotes:
      "Fluxo principal da empresa para operação biométrica. Logs técnicos avançados ficam restritos a suporte técnico e líder TC.",
    defaultScript: `const reference = input.processId ?? input.protocol;\nconst fingerprint = assets.resolve(step.inputBinding || "anelar-esquerdo");\n\nawait http.get(\`/api/processos/\${reference}\`);\nawait control.retry(async () => {\n  await biometrics.attach({\n    companySlug: session.companySlug,\n    mode: input.mode ?? "below",\n    fingerprint,\n    face: input.includeFace ? assets.optional("face") : null,\n  });\n}, { attempts: 2, backoffMs: 800 });\n\nreturn assertions.expectBiometricSync();`,
    steps: [
      {
        kind: "http_request",
        title: "Resolver processo",
        selector: "GET /api/processos/:id",
        inputBinding: "payload.processId || payload.protocol",
        expectedResult: "Processo válido e pronto para receber biometria.",
        description: "Localiza o processo usando id ou protocolo informado na interface.",
      },
      {
        kind: "upload_file",
        title: "Selecionar digital",
        selector: "asset:fingerprint",
        inputBinding: "asset.anelar-esquerdo",
        expectedResult: "Digital carregada com índice e formato válidos.",
        description: "Vincula a digital padrão da biblioteca ou uma nova evidência da empresa.",
      },
      {
        kind: "loop_until",
        title: "Controlar retry biométrico",
        selector: "retry until putStatus === 200",
        inputBinding: "runtime.retryPolicy",
        expectedResult: "A etapa repete dentro do limite configurado.",
        description: "Define tentativas e backoff antes de considerar falha definitiva.",
      },
      {
        kind: "http_request",
        title: "Executar PUT biométrico",
        selector: "PUT /api/processos/:id/biometria",
        inputBinding: "payload.target",
        expectedResult: "PUT retorna status de sucesso e resumo técnico.",
        description: "Faz o envio real da digital e opcionalmente da face.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar evidência",
        selector: "latest-output.json",
        inputBinding: "run.output",
        expectedResult: "Execução final fica rastreável por empresa.",
        description: "Armazena saída resumida, duração, paths e snapshot técnico.",
      },
    ],
  },
  {
    id: "cpf-rfb",
    title: "Consulta CPF / RFB",
    description: "Transforma a consulta de CPF em um fluxo guiado com ambiente, request, validação e histórico operacional.",
    objective: "Substituir execução manual de endpoint por formulário objetivo com versionamento e retries controlados.",
    stack: "HTTP runner + variáveis dinâmicas",
    runnerType: "http",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Ideal para smoke rápido, apoio operacional e treinamento da equipe.",
    defaultScript: `const cpf = payload.cpf.replace(/\\D/g, "");\nconst response = await http.get(\`/api/bcadastro/cpf/\${cpf}\`);\nassertions.expectStatus(response, 200);\nvariables.set("lastCpfLookup", cpf);\nreturn transformers.normalizeCpfLookup(response);`,
    steps: [
      {
        kind: "fill_field",
        title: "Informar CPF",
        selector: "[name='cpf']",
        inputBinding: "payload.cpf",
        expectedResult: "CPF saneado para consulta.",
        description: "Recebe o CPF e remove máscara antes do request.",
      },
      {
        kind: "http_request",
        title: "Consultar RFB",
        selector: "GET /api/bcadastro/cpf/:cpf",
        inputBinding: "payload.cpf",
        expectedResult: "Resposta com dados básicos ou erro conhecido.",
        description: "Executa a consulta principal via runner HTTP.",
      },
      {
        kind: "conditional_branch",
        title: "Tratar cenários divergentes",
        selector: "if (response.status !== 200)",
        inputBinding: "step.response",
        expectedResult: "Fluxo segue para fallback ou finalização conforme o retorno.",
        description: "Permite tratar CPF inexistente, instabilidade e resposta parcial.",
      },
      {
        kind: "capture_evidence",
        title: "Registrar histórico",
        selector: "run.summary",
        inputBinding: "run.result",
        expectedResult: "Linha pronta para auditoria e onboarding.",
        description: "Guarda duração, payload mascarado e resultado final.",
      },
    ],
  },
  {
    id: "token-processo",
    title: "Token + consulta de processo",
    description: "Encadeia autenticação e leitura de processo em uma mesma experiência operacional.",
    objective: "Evitar alternância manual entre login técnico, token e endpoint principal.",
    stack: "HTTP runner + sessão segura + subfluxos",
    runnerType: "http",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Boa base para evoluir em catálogo por ambiente, squads e smoke diário.",
    defaultScript: `const token = await auth.issueToken({ environment: environment.id });\nvariables.set("bearerToken", token);\nconst process = await http.get(\`/api/processos/\${payload.processId}\`, {\n  headers: { Authorization: \`Bearer \${token}\` },\n});\nreturn transformers.normalizeProcess(process);`,
    steps: [
      {
        kind: "subflow_call",
        title: "Emitir token",
        selector: "subflow:issue-token",
        inputBinding: "environment.id",
        expectedResult: "Sessão técnica emitida com segurança.",
        description: "Executa o subfluxo padrão de emissão de token para o ambiente escolhido.",
      },
      {
        kind: "http_request",
        title: "Consultar processo",
        selector: "GET /api/processos/:id",
        inputBinding: "payload.processId",
        expectedResult: "Processo carregado para leitura operacional.",
        description: "Usa o token recém-gerado e normaliza a resposta.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar resumo",
        selector: "run.output",
        inputBinding: "run.summary",
        expectedResult: "Execução disponível para reuso pela equipe.",
        description: "Registra os dados essenciais da execução.",
      },
    ],
  },
  {
    id: "smart-browser",
    title: "Fluxo visual Smart",
    description: "Base para abrir página, preencher dados, anexar arquivos, usar POM e validar mensagem de sucesso.",
    objective: "Dar autonomia visual ao QA quando o cenário exige navegador, upload ou etapas dependentes da UI.",
    stack: "Playwright guiado + evidências + Page Object Model",
    runnerType: "browser",
    realRunnerId: null,
    defaultStatus: "inactive",
    defaultNotes: "Use Playwright apenas onde houver navegador. O restante deve ficar no executor HTTP.",
    defaultScript: `import { SmartLoginPage, SmartCadastroPage } from "@/automations/pom";\n\nconst login = new SmartLoginPage(browser.page);\nconst cadastro = new SmartCadastroPage(browser.page);\n\nawait login.open(environment.baseUrl);\nawait login.signIn(payload.user, secrets.smartPassword);\nawait cadastro.openNovaFicha();\nawait cadastro.fillCpf(payload.cpf);\nawait cadastro.uploadDocumento(assets.resolve("foto-perfil"));\nawait cadastro.expectToast("Sucesso");\nreturn evidence.capture();`,
    steps: [
      {
        kind: "open_page",
        title: "Abrir Smart",
        selector: "/smart",
        inputBinding: "environment.baseUrl",
        expectedResult: "Tela pronta para interação.",
        description: "Abre a rota principal do fluxo visual.",
      },
      {
        kind: "subflow_call",
        title: "Executar login reutilizável",
        selector: "subflow:login-smart",
        inputBinding: "payload.user",
        expectedResult: "Sessão autenticada e pronta para as etapas de negócio.",
        description: "Reaproveita o login padrão sem duplicar script nos fluxos.",
      },
      {
        kind: "parallel_group",
        title: "Upload paralelo de evidências",
        selector: "parallel(upload-smart-assets)",
        inputBinding: "assets.documents",
        expectedResult: "Arquivos e imagens sobem antes da validação final.",
        description: "Permite anexos múltiplos e sincronização ao fim do grupo.",
      },
      {
        kind: "assert_text",
        title: "Validar sucesso",
        selector: "[data-testid='toast']",
        inputBinding: "Sucesso",
        expectedResult: "Mensagem renderizada na UI.",
        description: "Confirma a conclusão do fluxo no navegador.",
      },
    ],
  },
];

export const AUTOMATION_STUDIO_ASSETS: AutomationStudioAsset[] = [
  ...BIOMETRIC_FIXTURE_DEFINITIONS.filter((fixture) => fixture.kind === "face" || fixture.isStandard)
    .slice(0, 8)
    .map((fixture) => ({
      id: fixture.slug,
      title: fixture.label,
      category: fixture.kind === "face" ? "Face" : "Digitais",
      companyScoped: true,
      flowIds: ["griaule-biometrics", "smart-browser"],
      summary:
        fixture.kind === "face"
          ? "Fixture visual reutilizável para anexar face no fluxo biométrico."
          : `Digital padrão indexada em ${fixture.index ?? "manual"} para smoke ou carga controlada.`,
      type: "fixture" as const,
    })),
  {
    id: "cpf-sandbox",
    title: "CPF sandbox",
    category: "Massa",
    companyScoped: false,
    flowIds: ["cpf-rfb"],
    summary: "Payload de apoio para validar a consulta de CPF de forma padronizada.",
    type: "payload",
  },
  {
    id: "processo-smoke",
    title: "Processo smoke",
    category: "Massa",
    companyScoped: false,
    flowIds: ["token-processo"],
    summary: "Identificador curto para fluxo de autenticação e leitura.",
    type: "payload",
  },
  {
    id: "foto-perfil",
    title: "Foto de perfil",
    category: "Uploads",
    companyScoped: true,
    flowIds: ["smart-browser"],
    summary: "Arquivo visual que pode ser substituído pela biblioteca da empresa.",
    type: "file",
  },
  {
    id: "fingerprint-base64",
    title: "Base64 de digital",
    category: "Payload técnico",
    companyScoped: true,
    flowIds: ["griaule-biometrics"],
    summary: "Entrada técnica para campos que recebem imagem diretamente em texto.",
    type: "base64",
  },
];

export const AUTOMATION_STUDIO_SCRIPT_TEMPLATES: AutomationStudioScriptTemplate[] = [
  {
    id: "blank-js",
    title: "Fluxo em branco",
    summary: "Começo limpo para criar automação do zero direto no front.",
    code: `export default async function run({ browser, http, payload, variables }) {\n  // Monte o fluxo etapa por etapa.\n  return { ok: true, payload, variables };\n}`,
  },
  {
    id: "playwright-pom",
    title: "Playwright + POM",
    summary: "Template com Page Object Model para navegador e manutenção melhor.",
    code: `import { LoginPage, DashboardPage } from "@/automations/pom";\n\nexport default async function run({ browser, environment, payload, evidence }) {\n  const loginPage = new LoginPage(browser.page);\n  const dashboardPage = new DashboardPage(browser.page);\n\n  await loginPage.open(environment.baseUrl);\n  await loginPage.signIn(payload.user, payload.password);\n  await dashboardPage.assertLoaded();\n  return evidence.capture();\n}`,
  },
  {
    id: "playwright-api",
    title: "Playwright API testing",
    summary: "Usa request context para testar API dentro do mesmo módulo.",
    code: `export default async function run({ request, environment, payload, assertions }) {\n  const response = await request.get(\`\${environment.baseUrl}/api/processos/\${payload.processId}\`);\n  assertions.expectStatus(response, 200);\n  return response.json();\n}`,
  },
  {
    id: "parallel-upload",
    title: "Uploads paralelos",
    summary: "Modelo para anexos em massa com sincronização e evidência final.",
    code: `export default async function run({ assets, control, evidence }) {\n  await control.parallel([\n    () => assets.upload("documento-frente"),\n    () => assets.upload("documento-verso"),\n    () => assets.upload("selfie"),\n  ]);\n\n  return evidence.capture();\n}`,
  },
  {
    id: "conditional-loop",
    title: "Condição + retry",
    summary: "Modelo com if/else, fallback e repetição controlada.",
    code: `export default async function run({ http, control, payload }) {\n  const response = await control.retry(\n    () => http.get(\`/api/status/\${payload.id}\`),\n    { attempts: 3, backoffMs: 1000 },\n  );\n\n  if (response.status === 202) {\n    return { pending: true, action: "aguardar" };\n  }\n\n  return response;\n}`,
  },
];

export const AUTOMATION_STUDIO_SUBFLOW_LIBRARY: AutomationStudioSubflowTemplate[] = [
  {
    id: "login-smart",
    title: "Login Smart",
    summary: "Abre a aplicação, autentica e valida dashboard inicial.",
    steps: ["Abrir página", "Preencher usuário", "Preencher senha", "Validar dashboard"],
  },
  {
    id: "issue-token",
    title: "Issue token",
    summary: "Emite token técnico para os endpoints protegidos do ambiente.",
    steps: ["Selecionar ambiente", "Gerar token", "Salvar bearer token", "Retornar ao contexto"],
  },
  {
    id: "upload-smart-assets",
    title: "Upload de documentos",
    summary: "Agrupa anexos de foto, documento e selfie em um bloco reutilizável.",
    steps: ["Selecionar assets", "Executar uploads", "Sincronizar fim do grupo", "Capturar evidência"],
  },
];

export const AUTOMATION_STUDIO_TRIGGER_MODES: Array<{ id: AutomationStudioTriggerMode; label: string; summary: string }> = [
  {
    id: "manual",
    label: "Manual",
    summary: "Executado sob demanda pelo operador no front.",
  },
  {
    id: "webhook",
    label: "Webhook",
    summary: "Inicia o fluxo quando um evento externo chama a rota configurada.",
  },
  {
    id: "schedule",
    label: "Agendamento",
    summary: "Roda por cron para smoke, monitoramento ou carga periódica.",
  },
  {
    id: "file_watch",
    label: "Monitor de pasta",
    summary: "Dispara quando um arquivo novo chega em diretório monitorado.",
  },
];

export const AUTOMATION_STUDIO_SCRIPT_API = [
  "session.companySlug",
  "environment.baseUrl",
  "payload.<campo>",
  "variables.get/set('<chave>')",
  "assets.resolve('<asset-id>')",
  "assets.optional('<asset-id>')",
  "http.get/post/put(...)",
  "graphql.execute(...)",
  "browser.open/fill/upload(...)",
  "control.retry(...)",
  "control.parallel([...])",
  "assertions.expectStatus(...)",
  "evidence.capture()",
];
