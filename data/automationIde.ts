import { BIOMETRIC_FIXTURE_DEFINITIONS } from "@/data/biometricFixtures";

export type AutomationHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AutomationRequestPreset = {
  id: string;
  title: string;
  method: AutomationHttpMethod;
  path: string;
  body: string;
  headers: Array<{ key: string; value: string }>;
  companyScope: "all" | "griaule";
  tags: string[];
};

export type AutomationToolField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "switch";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
};

export type AutomationCompanyTool = {
  id: string;
  title: string;
  companySlug: "all" | "griaule";
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
    path: "/api/bcadastro/cpf/12345678900",
    body: "",
    headers: [],
    companyScope: "griaule",
    tags: ["rfb", "cpf"],
  },
  {
    id: "processo-by-id",
    title: "Consultar processo",
    method: "GET",
    path: "/api/processos/123456",
    body: "",
    headers: [],
    companyScope: "griaule",
    tags: ["processo"],
  },
  {
    id: "token-web",
    title: "Emitir token web",
    method: "GET",
    path: "/api/tokens/web",
    body: "",
    headers: [],
    companyScope: "griaule",
    tags: ["sessao", "token"],
  },
];

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
    pathPreset: "/api/bcadastro/cpf/12345678900",
    bodyTemplate: null,
    responseFocus: ["status", "json", "tempo"],
    fields: [
      {
        id: "cpf",
        label: "CPF",
        type: "text",
        placeholder: "Digite apenas números",
        required: true,
        defaultValue: "12345678900",
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
    pathPreset: "/api/processos/123456",
    bodyTemplate: null,
    responseFocus: ["status", "json"],
    fields: [
      {
        id: "processId",
        label: "Process ID",
        type: "text",
        placeholder: "Ex.: 123456",
        required: true,
        defaultValue: "123456",
      },
    ],
  },
  {
    id: "griaule-token",
    title: "Emitir token web",
    companySlug: "griaule",
    group: "Sessão",
    summary: "Executa o endpoint de sessão sem precisar abrir Postman ou script local.",
    mode: "proxy",
    method: "GET",
    pathTemplate: "/api/tokens/web",
    pathPreset: "/api/tokens/web",
    bodyTemplate: null,
    responseFocus: ["status", "headers", "json"],
    fields: [],
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
];

