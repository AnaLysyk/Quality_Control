import { BIOMETRIC_FIXTURE_DEFINITIONS } from "@/data/biometricFixtures";
import { normalizeAutomationCompanyScope, type AutomationCompanyScope } from "@/lib/automations/companyScope";

export type AutomationHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AutomationRequestKeyValue = {
  key: string;
  value: string;
};

export type AutomationRequestAuthType = "none" | "bearer" | "basic" | "api-key" | "session";

export type AutomationRequestAuth = {
  type: AutomationRequestAuthType;
  addTo?: "header" | "query";
  key?: string;
  password?: string;
  username?: string;
  value?: string;
};

export type AutomationAssertionType =
  | "status-equals"
  | "status-lt"
  | "json-path-equals"
  | "json-path-contains"
  | "header-exists"
  | "header-equals"
  | "response-time-lt";

export type AutomationAssertionRule = {
  id: string;
  type: AutomationAssertionType;
  path: string;
  expected: string;
};

export type AutomationRequestPreset = {
  id: string;
  title: string;
  method: AutomationHttpMethod;
  path: string;
  body: string;
  auth?: AutomationRequestAuth;
  headers: AutomationRequestKeyValue[];
  queryParams?: AutomationRequestKeyValue[];
  variables?: AutomationRequestKeyValue[];
  assertions?: AutomationAssertionRule[];
  preRequestScript?: string;
  companyScope: AutomationCompanyScope;
  tags: string[];
};

export type AutomationToolField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "password" | "select" | "switch";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
};

export type AutomationCompanyTool = {
  id: string;
  title: string;
  companySlug: AutomationCompanyScope;
  group: "Consulta" | "Biometria" | "Sessão" | "Documento";
  summary: string;
  mode: "proxy" | "internal";
  method: AutomationHttpMethod;
  pathTemplate?: string;
  internalPath?: string;
  pathPreset?: string;
  headers?: Record<string, string>;
  bodyTemplate?: Record<string, unknown> | null;
  responseFocus: string[];
  fields: AutomationToolField[];
};

export const AUTOMATION_IDE_METHODS: AutomationHttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const fingerprintOptions = BIOMETRIC_FIXTURE_DEFINITIONS.filter((fixture) => fixture.kind === "fingerprint").map((fixture) => ({
  label: fixture.label,
  value: fixture.slug,
}));

export const AUTOMATION_API_PRESETS: AutomationRequestPreset[] = [
  {
    id: "scratch",
    title: "Request em branco",
    method: "GET",
    path: "/api/health",
    body: "",
    headers: [],
    companyScope: "all",
    tags: ["base"],
  },
  {
    id: "rfb-cpf",
    title: "Consultar CPF / RFB",
    method: "GET",
    path: "/api/bcadastro/cpf/{{validCPF}}",
    body: "",
    auth: {
      type: "bearer",
      value: "{{token}}",
    },
    headers: [],
    companyScope: "griaule",
    tags: ["rfb", "cpf"],
  },
  {
    id: "griaule-token-credentials",
    title: "Criar token SMART",
    method: "POST",
    path: "/api/tokens",
    body: `{
  "data": {
    "grantType": "CREDENTIALS",
    "userName": "{{smartUser}}",
    "userPassword": "{{smartPassword}}",
    "token": ""
  }
}`,
    headers: [{ key: "Content-Type", value: "application/json" }],
    assertions: [{ id: "token-status-ok", type: "status-lt", path: "", expected: "300" }],
    companyScope: "griaule",
    tags: ["sessao", "token", "smart"],
  },
  {
    id: "griaule-ping",
    title: "Ping SMART API",
    method: "GET",
    path: "/api/ping",
    body: "",
    auth: {
      type: "bearer",
      value: "{{token}}",
    },
    headers: [],
    assertions: [{ id: "ping-status-ok", type: "status-lt", path: "", expected: "300" }],
    companyScope: "griaule",
    tags: ["health", "smart"],
  },
  {
    id: "processo-by-id",
    title: "Consultar processo",
    method: "GET",
    path: "/api/processos/{{processId}}",
    body: "",
    auth: {
      type: "bearer",
      value: "{{token}}",
    },
    headers: [],
    variables: [{ key: "processId", value: "" }],
    companyScope: "griaule",
    tags: ["processo"],
  },
  {
    id: "griaule-process-filter-valid-cpf",
    title: "Filtrar processos por CPF",
    method: "GET",
    path: "/api/process/filter",
    body: "",
    auth: {
      type: "bearer",
      value: "{{token}}",
    },
    headers: [],
    queryParams: [
      { key: "cpf", value: "{{validCPF}}" },
      { key: "pageNumber", value: "0" },
      { key: "pageSize", value: "10" },
      { key: "direction", value: "DESC" },
      { key: "sort", value: "CREATED_AT" },
    ],
    assertions: [{ id: "filter-status-ok", type: "status-lt", path: "", expected: "300" }],
    companyScope: "griaule",
    tags: ["processo", "cpf", "consulta"],
  },
  {
    id: "griaule-config-properties",
    title: "Config properties",
    method: "GET",
    path: "/api/config/properties",
    body: "",
    auth: {
      type: "bearer",
      value: "{{token}}",
    },
    headers: [],
    assertions: [{ id: "properties-status-ok", type: "status-lt", path: "", expected: "300" }],
    companyScope: "griaule",
    tags: ["config", "smart"],
  },
  {
    id: "qc-health",
    title: "Health do painel",
    method: "GET",
    path: "/api/health",
    body: "",
    headers: [],
    companyScope: "testing-company",
    tags: ["painel", "health", "smoke"],
  },
  {
    id: "qc-me",
    title: "Sessão autenticada",
    method: "GET",
    path: "/api/me",
    body: "",
    headers: [],
    auth: {
      type: "session",
    },
    companyScope: "testing-company",
    tags: ["painel", "auth", "session"],
  },
  {
    id: "qc-test-plans",
    title: "Planos de teste",
    method: "GET",
    path: "/api/test-plans",
    body: "",
    headers: [],
    auth: {
      type: "session",
    },
    companyScope: "testing-company",
    tags: ["painel", "test-plans"],
  },
];

export function getDefaultAutomationApiPreset(companySlug?: string | null) {
  const normalizedScope = normalizeAutomationCompanyScope(companySlug);
  const defaultId =
    normalizedScope === "griaule"
      ? "griaule-token-credentials"
      : normalizedScope === "testing-company"
        ? "qc-health"
        : "scratch";

  return AUTOMATION_API_PRESETS.find((preset) => preset.id === defaultId) ?? AUTOMATION_API_PRESETS[0];
}

export const AUTOMATION_COMPANY_TOOLS: AutomationCompanyTool[] = [
  {
    id: "griaule-rfb",
    title: "Consultar RFB",
    companySlug: "griaule",
    group: "Consulta",
    summary: "Consulta rápida por CPF com resposta técnica e visual no mesmo lugar.",
    mode: "proxy",
    method: "GET",
    pathTemplate: "/api/bcadastro/cpf/{{cpf}}",
    pathPreset: "/api/bcadastro/cpf/03659187682",
    headers: {
      Authorization: "Bearer {{token}}",
    },
    bodyTemplate: null,
    responseFocus: ["status", "json", "tempo"],
    fields: [
      {
        id: "cpf",
        label: "CPF",
        type: "text",
        placeholder: "Digite apenas números",
        required: true,
        defaultValue: "03659187682",
      },
      {
        id: "token",
        label: "Token",
        type: "text",
        placeholder: "Cole o token SMART",
        required: true,
      },
    ],
  },
  {
    id: "griaule-processo",
    title: "Consultar processo",
    companySlug: "griaule",
    group: "Consulta",
    summary: "Busca processo por ID e deixa o retorno pronto para validação operacional.",
    mode: "proxy",
    method: "GET",
    pathTemplate: "/api/processos/{{processId}}",
    pathPreset: "/api/processos/{{processId}}",
    headers: {
      Authorization: "Bearer {{token}}",
    },
    bodyTemplate: null,
    responseFocus: ["status", "json"],
    fields: [
      {
        id: "processId",
        label: "Process ID",
        type: "text",
        placeholder: "Ex.: 123456",
        required: true,
      },
      {
        id: "token",
        label: "Token",
        type: "text",
        placeholder: "Cole o token SMART",
        required: true,
      },
    ],
  },
  {
    id: "griaule-token",
    title: "Criar token SMART",
    companySlug: "griaule",
    group: "Sessão",
    summary: "Executa o endpoint de sessão sem precisar abrir Postman ou script local.",
    mode: "proxy",
    method: "POST",
    pathTemplate: "/api/tokens",
    pathPreset: "/api/tokens",
    headers: {
      "Content-Type": "application/json",
    },
    bodyTemplate: {
      data: {
        grantType: "CREDENTIALS",
        userName: "{{smartUser}}",
        userPassword: "{{smartPassword}}",
        token: "",
      },
    },
    responseFocus: ["status", "headers", "json"],
    fields: [
      {
        id: "smartUser",
        label: "Usuario",
        type: "text",
        required: true,
        defaultValue: "gbds_bind",
      },
      {
        id: "smartPassword",
        label: "Senha",
        type: "password",
        placeholder: "Senha do ambiente",
        required: true,
      },
    ],
  },
  {
    id: "griaule-biometrics",
    title: "Anexar biometria",
    companySlug: "griaule",
    group: "Biometria",
    summary: "Chama o runner interno com processo, digital, face e modo configurável.",
    mode: "internal",
    method: "POST",
    internalPath: "/api/automations/griaule/biometrics",
    bodyTemplate: {
      companySlug: "{{companySlug}}",
      processId: "{{processId}}",
      protocol: "{{protocol}}",
      mode: "{{mode}}",
      includeFace: "{{includeFace}}",
      faceFixture: "{{faceFixture}}",
      fingerprint: {
        fixture: "{{fingerprintFixture}}",
      },
    },
    responseFocus: ["putStatus", "durationMs", "latestOutputPath"],
    fields: [
      {
        id: "companySlug",
        label: "Empresa",
        type: "text",
        placeholder: "Slug da empresa",
        required: true,
        defaultValue: "griaule",
      },
      {
        id: "processId",
        label: "Process ID",
        type: "text",
        placeholder: "Opcional se protocol for informado",
      },
      {
        id: "protocol",
        label: "Protocol",
        type: "text",
        placeholder: "Opcional se processId for informado",
      },
      {
        id: "mode",
        label: "Modo",
        type: "select",
        defaultValue: "below",
        options: [
          { label: "Below", value: "below" },
          { label: "Above", value: "above" },
        ],
      },
      {
        id: "fingerprintFixture",
        label: "Digital",
        type: "select",
        required: true,
        defaultValue: "anelar-esquerdo",
        options: fingerprintOptions,
      },
      {
        id: "faceFixture",
        label: "Face",
        type: "select",
        defaultValue: "face",
        options: [{ label: "Face", value: "face" }],
      },
      {
        id: "includeFace",
        label: "Incluir face",
        type: "switch",
        defaultValue: true,
      },
    ],
  },
  {
    id: "qc-admin-dashboard",
    title: "Smoke dashboard admin",
    companySlug: "testing-company",
    group: "Consulta",
    summary: "Valida se o dashboard administrativo do próprio painel abre autenticado e sem cair no login.",
    mode: "internal",
    method: "POST",
    internalPath: "/api/automations/qc/page-smoke",
    bodyTemplate: {
      companySlug: "{{companySlug}}",
      expectedText: "Buscar empresa por nome ou slug",
      targetPath: "/admin/dashboard",
      titleHint: "Quality Control",
    },
    responseFocus: ["status", "title", "finalUrl", "containsExpectedText"],
    fields: [
      {
        id: "companySlug",
        label: "Empresa",
        type: "text",
        required: true,
        defaultValue: "testing-company",
      },
    ],
  },
  {
    id: "qc-automations-tools",
    title: "Smoke automações IDE",
    companySlug: "testing-company",
    group: "Consulta",
    summary: "Abre o módulo de automação do próprio sistema e confirma que a shell principal respondeu.",
    mode: "internal",
    method: "POST",
    internalPath: "/api/automations/qc/page-smoke",
    bodyTemplate: {
      companySlug: "{{companySlug}}",
      expectedText: "QA IDE",
      targetPath: "/automacoes/tools",
      titleHint: "Automações",
    },
    responseFocus: ["status", "title", "finalUrl", "containsExpectedText"],
    fields: [
      {
        id: "companySlug",
        label: "Empresa",
        type: "text",
        required: true,
        defaultValue: "testing-company",
      },
    ],
  },
  {
    id: "qc-company-home",
    title: "Smoke home da empresa",
    companySlug: "testing-company",
    group: "Consulta",
    summary: "Testa a home institucional da empresa ativa e garante que a tela principal abre com sessão válida.",
    mode: "internal",
    method: "POST",
    internalPath: "/api/automations/qc/page-smoke",
    bodyTemplate: {
      companySlug: "{{companySlug}}",
      expectedText: "Home institucional",
      targetPath: "/empresas/{{companySlug}}/home",
      titleHint: "Home",
    },
    responseFocus: ["status", "title", "finalUrl", "containsExpectedText"],
    fields: [
      {
        id: "companySlug",
        label: "Empresa",
        type: "text",
        required: true,
        defaultValue: "testing-company",
      },
    ],
  },
  {
    id: "qc-company-runs",
    title: "Smoke runs da empresa",
    companySlug: "testing-company",
    group: "Consulta",
    summary: "Verifica se a tela de runs da empresa responde autenticada para o contexto da Testing Company.",
    mode: "internal",
    method: "POST",
    internalPath: "/api/automations/qc/page-smoke",
    bodyTemplate: {
      companySlug: "{{companySlug}}",
      expectedText: "runs-page",
      targetPath: "/empresas/{{companySlug}}/runs",
      titleHint: "Runs",
    },
    responseFocus: ["status", "title", "finalUrl", "containsExpectedText"],
    fields: [
      {
        id: "companySlug",
        label: "Empresa",
        type: "text",
        required: true,
        defaultValue: "testing-company",
      },
    ],
  },
  {
    id: "qc-company-defects",
    title: "Smoke defeitos da empresa",
    companySlug: "testing-company",
    group: "Consulta",
    summary: "Executa leitura rápida da tela de defeitos para validar carregamento e autenticação do painel.",
    mode: "internal",
    method: "POST",
    internalPath: "/api/automations/qc/page-smoke",
    bodyTemplate: {
      companySlug: "{{companySlug}}",
      expectedText: "defeitos",
      targetPath: "/empresas/{{companySlug}}/defeitos",
      titleHint: "Defeitos",
    },
    responseFocus: ["status", "title", "finalUrl", "containsExpectedText"],
    fields: [
      {
        id: "companySlug",
        label: "Empresa",
        type: "text",
        required: true,
        defaultValue: "testing-company",
      },
    ],
  },
];
