import { BIOMETRIC_FIXTURE_DEFINITIONS } from "@/data/biometricFixtures";
import type { AutomationCompanyScope } from "@/lib/automations/companyScope";

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
  companyScope: AutomationCompanyScope;
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
    title: "Abrir pÃ¡gina",
    selector: "https://sistema/rota",
    inputBinding: "environment.baseUrl",
    expectedResult: "A pÃ¡gina inicial fica pronta para interaÃ§Ã£o.",
    description: "Abre uma URL ou rota do ambiente configurado.",
  },
  {
    kind: "http_request",
    title: "Executar request REST",
    selector: "GET /api/recurso",
    inputBinding: "payload.processId",
    expectedResult: "Retorna 200 e corpo normalizado para a etapa seguinte.",
    description: "Dispara um endpoint com autenticaÃ§Ã£o centralizada no backend.",
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
    expectedResult: "Campo preenchido sem erro de mÃ¡scara.",
    description: "Preenche texto, nÃºmero, token ou valor derivado do ambiente.",
  },
  {
    kind: "select_option",
    title: "Selecionar opÃ§Ã£o",
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
    description: "Usa arquivo local, fixture ou biblioteca de evidÃªncias da empresa.",
  },
  {
    kind: "paste_base64",
    title: "Colar base64",
    selector: "[data-field='digital']",
    inputBinding: "asset.fingerprintBase64",
    expectedResult: "Campo tÃ©cnico recebe a digital codificada.",
    description: "CenÃ¡rio tÃ­pico para biometria, payload de imagem e integraÃ§Ãµes antigas.",
  },
  {
    kind: "wait_for_element",
    title: "Esperar elemento",
    selector: "[data-testid='success-banner']",
    inputBinding: "timeout.5000",
    expectedResult: "Elemento aparece dentro da janela configurada.",
    description: "Segura o fluxo atÃ© a aplicaÃ§Ã£o estabilizar.",
  },
  {
    kind: "assert_text",
    title: "Validar texto",
    selector: "[data-testid='status']",
    inputBinding: "Sucesso",
    expectedResult: "Texto renderizado bate com o esperado.",
    description: "Garante a resposta final de negÃ³cio sem olhar sÃ³ status HTTP.",
  },
  {
    kind: "conditional_branch",
    title: "CondiÃ§Ã£o / if-else",
    selector: "if (context.status === 'PENDING')",
    inputBinding: "step.output",
    expectedResult: "Fluxo escolhe o prÃ³ximo caminho dinamicamente.",
    description: "Controla bifurcaÃ§Ã£o por payload, status, ambiente ou resultado anterior.",
  },
  {
    kind: "loop_until",
    title: "Loop / retry controlado",
    selector: "while (!result.ready)",
    inputBinding: "step.output",
    expectedResult: "Etapa repete atÃ© cumprir a condiÃ§Ã£o ou atingir o limite.",
    description: "Ãštil para polling, tentativas adicionais e cenÃ¡rios assÃ­ncronos.",
  },
  {
    kind: "parallel_group",
    title: "Grupo paralelo",
    selector: "parallel(upload-docs)",
    inputBinding: "assets.documents",
    expectedResult: "Tarefas independentes terminam antes da sincronizaÃ§Ã£o final.",
    description: "Permite upload em massa, mÃºltiplos requests e fan-out controlado.",
  },
  {
    kind: "subflow_call",
    title: "Chamar subfluxo",
    selector: "subflow:login-smart",
    inputBinding: "variables.auth",
    expectedResult: "Trecho reutilizÃ¡vel executado sem duplicar cÃ³digo.",
    description: "Encapsula login, navegaÃ§Ã£o, tokenizaÃ§Ã£o e passos recorrentes.",
  },
  {
    kind: "approval_gate",
    title: "AprovaÃ§Ã£o humana",
    selector: "approve:analista-qa",
    inputBinding: "run.summary",
    expectedResult: "Fluxo pausa atÃ© aceite, ajuste ou rejeiÃ§Ã£o manual.",
    description: "Usado em processos crÃ­ticos, anÃ¡lise visual e validaÃ§Ã£o sensÃ­vel.",
  },
  {
    kind: "capture_evidence",
    title: "Capturar evidÃªncia",
    selector: "screen",
    inputBinding: "run.evidence",
    expectedResult: "Screenshot, payload e log ficam anexados ao histÃ³rico.",
    description: "Guarda o resultado para auditoria, debugging ou suporte.",
  },
  {
    kind: "custom_script",
    title: "Script customizado",
    selector: "stepContext",
    inputBinding: "helpers",
    expectedResult: "A etapa executa uma regra especÃ­fica sem sair do front.",
    description: "Permite complementar o fluxo com JavaScript orientado a contexto.",
  },
];

export const AUTOMATION_STUDIO_BLUEPRINTS: AutomationStudioBlueprint[] = [
  {
    companyScope: "all",
    id: "api-smoke-base",
    title: "Fluxo base API",
    description: "Template neutro para qualquer empresa comeÃ§ar um fluxo simples de request, validaÃ§Ã£o e evidÃªncia.",
    objective: "Oferecer um ponto de partida sem expor fluxos especÃ­ficos de outra empresa.",
    stack: "HTTP runner + variÃ¡veis dinÃ¢micas",
    runnerType: "http",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Fluxo inicial neutro para novas empresas e contextos ainda sem catÃ¡logo dedicado.",
    defaultScript: `const response = await http.get("/api/health");\nassertions.expectStatus(response, 200);\nreturn evidence.capture();`,
    steps: [
      {
        kind: "http_request",
        title: "Executar smoke base",
        selector: "GET /api/health",
        inputBinding: "environment.baseUrl",
        expectedResult: "Endpoint bÃ¡sico responde sem erro.",
        description: "Request neutro para validar ambiente e sessÃ£o inicial.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar evidÃªncia",
        selector: "run.summary",
        inputBinding: "run.result",
        expectedResult: "Resultado salvo no histÃ³rico.",
        description: "MantÃ©m o snapshot do smoke inicial.",
      },
    ],
  },
  {
    companyScope: "griaule",
    id: "griaule-biometrics",
    title: "Biometria Griaule",
    description: "Fluxo real para anexar digital e face com controle de limite Base64, retries e auditoria do PUT.",
    objective: "Executar GET/PUT/GET com visibilidade por empresa e preparar o runner below/above pela interface.",
    stack: "HTTP runner + fixtures locais + debug operacional",
    runnerType: "hybrid",
    realRunnerId: "griaule-biometrics",
    defaultStatus: "active",
    defaultNotes:
      "Fluxo principal da empresa para operaÃ§Ã£o biomÃ©trica. Logs tÃ©cnicos avanÃ§ados ficam restritos a suporte tÃ©cnico e lÃ­der TC.",
    defaultScript: `const reference = input.processId ?? input.protocol;\nconst fingerprint = assets.resolve(step.inputBinding || "anelar-esquerdo");\n\nawait http.get(\`/api/processos/\${reference}\`);\nawait control.retry(async () => {\n  await biometrics.attach({\n    companySlug: session.companySlug,\n    mode: input.mode ?? "below",\n    fingerprint,\n    face: input.includeFace ? assets.optional("face") : null,\n  });\n}, { attempts: 2, backoffMs: 800 });\n\nreturn assertions.expectBiometricSync();`,
    steps: [
      {
        kind: "http_request",
        title: "Resolver processo",
        selector: "GET /api/processos/:id",
        inputBinding: "payload.processId || payload.protocol",
        expectedResult: "Processo vÃ¡lido e pronto para receber biometria.",
        description: "Localiza o processo usando id ou protocolo informado na interface.",
      },
      {
        kind: "upload_file",
        title: "Selecionar digital",
        selector: "asset:fingerprint",
        inputBinding: "asset.anelar-esquerdo",
        expectedResult: "Digital carregada com Ã­ndice e formato vÃ¡lidos.",
        description: "Vincula a digital padrÃ£o da biblioteca ou uma nova evidÃªncia da empresa.",
      },
      {
        kind: "loop_until",
        title: "Controlar retry biomÃ©trico",
        selector: "retry until putStatus === 200",
        inputBinding: "runtime.retryPolicy",
        expectedResult: "A etapa repete dentro do limite configurado.",
        description: "Define tentativas e backoff antes de considerar falha definitiva.",
      },
      {
        kind: "http_request",
        title: "Executar PUT biomÃ©trico",
        selector: "PUT /api/processos/:id/biometria",
        inputBinding: "payload.target",
        expectedResult: "PUT retorna status de sucesso e resumo tÃ©cnico.",
        description: "Faz o envio real da digital e opcionalmente da face.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar evidÃªncia",
        selector: "latest-output.json",
        inputBinding: "run.output",
        expectedResult: "ExecuÃ§Ã£o final fica rastreÃ¡vel por empresa.",
        description: "Armazena saÃ­da resumida, duraÃ§Ã£o, paths e snapshot tÃ©cnico.",
      },
    ],
  },
  {
    companyScope: "griaule",
    id: "cpf-rfb",
    title: "Consulta CPF / RFB",
    description: "Transforma a consulta de CPF em um fluxo guiado com ambiente, request, validaÃ§Ã£o e histÃ³rico operacional.",
    objective: "Substituir execuÃ§Ã£o manual de endpoint por formulÃ¡rio objetivo com versionamento e retries controlados.",
    stack: "HTTP runner + variÃ¡veis dinÃ¢micas",
    runnerType: "http",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Ideal para smoke rÃ¡pido, apoio operacional e treinamento da equipe.",
    defaultScript: `const cpf = payload.cpf.replace(/\\D/g, "");\nconst response = await http.get(\`/api/bcadastro/cpf/\${cpf}\`);\nassertions.expectStatus(response, 200);\nvariables.set("lastCpfLookup", cpf);\nreturn transformers.normalizeCpfLookup(response);`,
    steps: [
      {
        kind: "fill_field",
        title: "Informar CPF",
        selector: "[name='cpf']",
        inputBinding: "payload.cpf",
        expectedResult: "CPF saneado para consulta.",
        description: "Recebe o CPF e remove mÃ¡scara antes do request.",
      },
      {
        kind: "http_request",
        title: "Consultar RFB",
        selector: "GET /api/bcadastro/cpf/:cpf",
        inputBinding: "payload.cpf",
        expectedResult: "Resposta com dados bÃ¡sicos ou erro conhecido.",
        description: "Executa a consulta principal via runner HTTP.",
      },
      {
        kind: "conditional_branch",
        title: "Tratar cenÃ¡rios divergentes",
        selector: "if (response.status !== 200)",
        inputBinding: "step.response",
        expectedResult: "Fluxo segue para fallback ou finalizaÃ§Ã£o conforme o retorno.",
        description: "Permite tratar CPF inexistente, instabilidade e resposta parcial.",
      },
      {
        kind: "capture_evidence",
        title: "Registrar histÃ³rico",
        selector: "run.summary",
        inputBinding: "run.result",
        expectedResult: "Linha pronta para auditoria e onboarding.",
        description: "Guarda duraÃ§Ã£o, payload mascarado e resultado final.",
      },
    ],
  },
  {
    companyScope: "griaule",
    id: "token-processo",
    title: "Token + consulta de processo",
    description: "Encadeia autenticaÃ§Ã£o e leitura de processo em uma mesma experiÃªncia operacional.",
    objective: "Evitar alternÃ¢ncia manual entre login tÃ©cnico, token e endpoint principal.",
    stack: "HTTP runner + sessÃ£o segura + subfluxos",
    runnerType: "http",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Boa base para evoluir em catÃ¡logo por ambiente, squads e smoke diÃ¡rio.",
    defaultScript: `const token = await auth.issueToken({ environment: environment.id });\nvariables.set("bearerToken", token);\nconst process = await http.get(\`/api/processos/\${payload.processId}\`, {\n  headers: { Authorization: \`Bearer \${token}\` },\n});\nreturn transformers.normalizeProcess(process);`,
    steps: [
      {
        kind: "subflow_call",
        title: "Emitir token",
        selector: "subflow:issue-token",
        inputBinding: "environment.id",
        expectedResult: "SessÃ£o tÃ©cnica emitida com seguranÃ§a.",
        description: "Executa o subfluxo padrÃ£o de emissÃ£o de token para o ambiente escolhido.",
      },
      {
        kind: "http_request",
        title: "Consultar processo",
        selector: "GET /api/processos/:id",
        inputBinding: "payload.processId",
        expectedResult: "Processo carregado para leitura operacional.",
        description: "Usa o token recÃ©m-gerado e normaliza a resposta.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar resumo",
        selector: "run.output",
        inputBinding: "run.summary",
        expectedResult: "ExecuÃ§Ã£o disponÃ­vel para reuso pela equipe.",
        description: "Registra os dados essenciais da execuÃ§Ã£o.",
      },
    ],
  },
  {
    companyScope: "griaule",
    id: "smart-browser",
    title: "Fluxo visual Smart",
    description: "Base para abrir pÃ¡gina, preencher dados, anexar arquivos, usar POM e validar mensagem de sucesso.",
    objective: "Dar autonomia visual ao QA quando o cenÃ¡rio exige navegador, upload ou etapas dependentes da UI.",
    stack: "Playwright guiado + evidÃªncias + Page Object Model",
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
        expectedResult: "Tela pronta para interaÃ§Ã£o.",
        description: "Abre a rota principal do fluxo visual.",
      },
      {
        kind: "subflow_call",
        title: "Executar login reutilizÃ¡vel",
        selector: "subflow:login-smart",
        inputBinding: "payload.user",
        expectedResult: "SessÃ£o autenticada e pronta para as etapas de negÃ³cio.",
        description: "Reaproveita o login padrÃ£o sem duplicar script nos fluxos.",
      },
      {
        kind: "parallel_group",
        title: "Upload paralelo de evidÃªncias",
        selector: "parallel(upload-smart-assets)",
        inputBinding: "assets.documents",
        expectedResult: "Arquivos e imagens sobem antes da validaÃ§Ã£o final.",
        description: "Permite anexos mÃºltiplos e sincronizaÃ§Ã£o ao fim do grupo.",
      },
      {
        kind: "assert_text",
        title: "Validar sucesso",
        selector: "[data-testid='toast']",
        inputBinding: "Sucesso",
        expectedResult: "Mensagem renderizada na UI.",
        description: "Confirma a conclusÃ£o do fluxo no navegador.",
      },
    ],
  },
  {
    companyScope: "testing-company",
    id: "qc-admin-dashboard",
    title: "Dashboard admin do Painel QA",
    description: "Smoke browser do dashboard administrativo da prÃ³pria plataforma, validando shell, busca e contexto inicial.",
    objective: "Garantir que a tela principal do admin continue acessÃ­vel e autenticada antes de qualquer release.",
    stack: "Playwright guiado + smoke interno do produto",
    runnerType: "browser",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Fluxo focado na Testing Company para validar a camada administrativa do prÃ³prio painel.",
    defaultScript: `await browser.page.goto(\`\${environment.baseUrl}/admin/dashboard\`);\nawait assertions.expectText("Buscar empresa por nome ou slug");\nreturn evidence.capture();`,
    steps: [
      {
        kind: "open_page",
        title: "Abrir dashboard admin",
        selector: "/admin/dashboard",
        inputBinding: "environment.baseUrl",
        expectedResult: "Dashboard responde sem redirecionar para login.",
        description: "Acessa a tela administrativa principal do painel.",
      },
      {
        kind: "assert_text",
        title: "Validar campo de busca",
        selector: "Buscar empresa por nome ou slug",
        inputBinding: "page.content",
        expectedResult: "Busca principal do dashboard visÃ­vel.",
        description: "Confirma que a tela carregou com o bloco principal do admin.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar evidÃªncia",
        selector: "screen",
        inputBinding: "run.evidence",
        expectedResult: "Screenshot e resultado salvos.",
        description: "Guarda artefato do smoke do dashboard.",
      },
    ],
  },
  {
    companyScope: "testing-company",
    id: "qc-automation-ide",
    title: "QA IDE do Painel QA",
    description: "Smoke browser da nova shell de automaÃ§Ã£o para validar navegaÃ§Ã£o, cards e Ã¡rea principal do workspace.",
    objective: "Garantir que o mÃ³dulo de automaÃ§Ã£o da prÃ³pria plataforma siga acessÃ­vel e coerente visualmente.",
    stack: "Playwright guiado + smoke interno do produto",
    runnerType: "browser",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Fluxo interno da Testing Company para validar a IDE de automaÃ§Ã£o antes de abrir para operaÃ§Ã£o.",
    defaultScript: `await browser.page.goto(\`\${environment.baseUrl}/automacoes/tools\`);\nawait assertions.expectText("QA IDE");\nawait assertions.expectText("Tools");\nreturn evidence.capture();`,
    steps: [
      {
        kind: "open_page",
        title: "Abrir QA IDE",
        selector: "/automacoes/tools",
        inputBinding: "environment.baseUrl",
        expectedResult: "Shell de automaÃ§Ã£o carregada.",
        description: "Acessa a entrada principal do mÃ³dulo de automaÃ§Ã£o.",
      },
      {
        kind: "assert_text",
        title: "Validar navegaÃ§Ã£o",
        selector: "QA IDE",
        inputBinding: "page.content",
        expectedResult: "TÃ­tulo da shell e mÃ³dulos visÃ­veis.",
        description: "Confirma que a lateral e a Ã¡rea principal renderizaram.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar evidÃªncia",
        selector: "screen",
        inputBinding: "run.evidence",
        expectedResult: "Screenshot do mÃ³dulo salvo no histÃ³rico.",
        description: "Guarda artefato do smoke da IDE.",
      },
    ],
  },
  {
    companyScope: "testing-company",
    id: "qc-company-home",
    title: "Home institucional da empresa",
    description: "Valida a home da empresa Testing Company e a separaÃ§Ã£o entre home institucional e dashboard.",
    objective: "Garantir que a entrada da empresa continue Ã­ntegra apÃ³s alteraÃ§Ãµes na navegaÃ§Ã£o do produto.",
    stack: "Playwright guiado + smoke interno do produto",
    runnerType: "browser",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Fluxo interno para validar a camada institucional da empresa dentro do prÃ³prio painel.",
    defaultScript: `await browser.page.goto(\`\${environment.baseUrl}/empresas/testing-company/home\`);\nawait assertions.expectText("Home institucional");\nreturn evidence.capture();`,
    steps: [
      {
        kind: "open_page",
        title: "Abrir home da empresa",
        selector: "/empresas/testing-company/home",
        inputBinding: "environment.baseUrl",
        expectedResult: "Home institucional abre com contexto ativo.",
        description: "Acessa a home da empresa Testing Company.",
      },
      {
        kind: "assert_text",
        title: "Validar contexto institucional",
        selector: "Home institucional",
        inputBinding: "page.content",
        expectedResult: "Texto institucional disponÃ­vel na tela.",
        description: "Confirma que a tela correta abriu.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar evidÃªncia",
        selector: "screen",
        inputBinding: "run.evidence",
        expectedResult: "Screenshot salvo no histÃ³rico.",
        description: "Guarda artefato do smoke da home.",
      },
    ],
  },
  {
    companyScope: "testing-company",
    id: "qc-company-runs",
    title: "Runs da empresa Testing Company",
    description: "Smoke browser da tela de runs para garantir leitura operacional do prÃ³prio sistema.",
    objective: "Validar que a tela de runs do produto continua abrindo com filtros e listagem operacional.",
    stack: "Playwright guiado + smoke interno do produto",
    runnerType: "browser",
    realRunnerId: null,
    defaultStatus: "active",
    defaultNotes: "Fluxo interno para validar a pÃ¡gina de runs da empresa Testing Company.",
    defaultScript: `await browser.page.goto(\`\${environment.baseUrl}/empresas/testing-company/runs\`);\nawait assertions.expectText("runs-page");\nreturn evidence.capture();`,
    steps: [
      {
        kind: "open_page",
        title: "Abrir runs da empresa",
        selector: "/empresas/testing-company/runs",
        inputBinding: "environment.baseUrl",
        expectedResult: "Tela de runs responde autenticada.",
        description: "Acessa a listagem operacional de runs da empresa.",
      },
      {
        kind: "assert_text",
        title: "Validar listagem operacional",
        selector: "runs-page",
        inputBinding: "page.content",
        expectedResult: "A pÃ¡gina de runs estÃ¡ renderizada.",
        description: "Confirma a presenÃ§a da Ã¡rea principal da listagem.",
      },
      {
        kind: "capture_evidence",
        title: "Salvar evidÃªncia",
        selector: "screen",
        inputBinding: "run.evidence",
        expectedResult: "Screenshot salvo no histÃ³rico.",
        description: "Guarda artefato do smoke das runs.",
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
          ? "Fixture visual reutilizÃ¡vel para anexar face no fluxo biomÃ©trico."
          : `Digital padrÃ£o indexada em ${fixture.index ?? "manual"} para smoke ou carga controlada.`,
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
    summary: "Identificador curto para fluxo de autenticaÃ§Ã£o e leitura.",
    type: "payload",
  },
  {
    id: "foto-perfil",
    title: "Foto de perfil",
    category: "Uploads",
    companyScoped: true,
    flowIds: ["smart-browser"],
    summary: "Arquivo visual que pode ser substituÃ­do pela biblioteca da empresa.",
    type: "file",
  },
  {
    id: "fingerprint-base64",
    title: "Base64 de digital",
    category: "Payload tÃ©cnico",
    companyScoped: true,
    flowIds: ["griaule-biometrics"],
    summary: "Entrada tÃ©cnica para campos que recebem imagem diretamente em texto.",
    type: "base64",
  },
];

export const AUTOMATION_STUDIO_SCRIPT_TEMPLATES: AutomationStudioScriptTemplate[] = [
  {
    id: "blank-js",
    title: "Fluxo em branco",
    summary: "ComeÃ§o limpo para criar automaÃ§Ã£o do zero direto no front.",
    code: `export default async function run({ browser, http, payload, variables }) {\n  // Monte o fluxo etapa por etapa.\n  return { ok: true, payload, variables };\n}`,
  },
  {
    id: "playwright-pom",
    title: "Playwright + POM",
    summary: "Template com Page Object Model para navegador e manutenÃ§Ã£o melhor.",
    code: `import { LoginPage, DashboardPage } from "@/automations/pom";\n\nexport default async function run({ browser, environment, payload, evidence }) {\n  const loginPage = new LoginPage(browser.page);\n  const dashboardPage = new DashboardPage(browser.page);\n\n  await loginPage.open(environment.baseUrl);\n  await loginPage.signIn(payload.user, payload.password);\n  await dashboardPage.assertLoaded();\n  return evidence.capture();\n}`,
  },
  {
    id: "playwright-api",
    title: "Playwright API testing",
    summary: "Usa request context para testar API dentro do mesmo mÃ³dulo.",
    code: `export default async function run({ request, environment, payload, assertions }) {\n  const response = await request.get(\`\${environment.baseUrl}/api/processos/\${payload.processId}\`);\n  assertions.expectStatus(response, 200);\n  return response.json();\n}`,
  },
  {
    id: "parallel-upload",
    title: "Uploads paralelos",
    summary: "Modelo para anexos em massa com sincronizaÃ§Ã£o e evidÃªncia final.",
    code: `export default async function run({ assets, control, evidence }) {\n  await control.parallel([\n    () => assets.upload("documento-frente"),\n    () => assets.upload("documento-verso"),\n    () => assets.upload("selfie"),\n  ]);\n\n  return evidence.capture();\n}`,
  },
  {
    id: "conditional-loop",
    title: "CondiÃ§Ã£o + retry",
    summary: "Modelo com if/else, fallback e repetiÃ§Ã£o controlada.",
    code: `export default async function run({ http, control, payload }) {\n  const response = await control.retry(\n    () => http.get(\`/api/status/\${payload.id}\`),\n    { attempts: 3, backoffMs: 1000 },\n  );\n\n  if (response.status === 202) {\n    return { pending: true, action: "aguardar" };\n  }\n\n  return response;\n}`,
  },
];

export const AUTOMATION_STUDIO_SUBFLOW_LIBRARY: AutomationStudioSubflowTemplate[] = [
  {
    id: "login-smart",
    title: "Login Smart",
    summary: "Abre a aplicaÃ§Ã£o, autentica e valida dashboard inicial.",
    steps: ["Abrir pÃ¡gina", "Preencher usuÃ¡rio", "Preencher senha", "Validar dashboard"],
  },
  {
    id: "issue-token",
    title: "Issue token",
    summary: "Emite token tÃ©cnico para os endpoints protegidos do ambiente.",
    steps: ["Selecionar ambiente", "Gerar token", "Salvar bearer token", "Retornar ao contexto"],
  },
  {
    id: "upload-smart-assets",
    title: "Upload de documentos",
    summary: "Agrupa anexos de foto, documento e selfie em um bloco reutilizÃ¡vel.",
    steps: ["Selecionar assets", "Executar uploads", "Sincronizar fim do grupo", "Capturar evidÃªncia"],
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
    summary: "Roda por cron para smoke, monitoramento ou carga periÃ³dica.",
  },
  {
    id: "file_watch",
    label: "Monitor de pasta",
    summary: "Dispara quando um arquivo novo chega em diretÃ³rio monitorado.",
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

