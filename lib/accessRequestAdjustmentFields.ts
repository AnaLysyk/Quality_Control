import type { AccessRequestAdjustmentField } from "@/lib/accessRequestMessage";

export type AccessRequestAdjustmentCategory = "context" | "registration" | "company";

export type AccessRequestAdjustmentFieldDefinition = {
  field: AccessRequestAdjustmentField;
  label: string;
  category: AccessRequestAdjustmentCategory;
  inputType: "text" | "email" | "password" | "select" | "textarea";
  editableByReviewer: boolean;
  editableByRequester: boolean;
  description: string;
};

export const ACCESS_REQUEST_ADJUSTMENT_FIELD_DEFINITIONS: AccessRequestAdjustmentFieldDefinition[] = [
  {
    field: "title",
    label: "TÃ­tulo",
    category: "context",
    inputType: "text",
    editableByReviewer: false,
    editableByRequester: false,
    description: "Contexto informado pelo solicitante. NÃ£o Ã© ajuste formal de cadastro.",
  },
  {
    field: "description",
    label: "DescriÃ§Ã£o",
    category: "context",
    inputType: "textarea",
    editableByReviewer: false,
    editableByRequester: false,
    description: "DescriÃ§Ã£o original da solicitaÃ§Ã£o. NÃ£o deve voltar como campo de ajuste.",
  },
  {
    field: "notes",
    label: "ObservaÃ§Ãµes",
    category: "context",
    inputType: "textarea",
    editableByReviewer: false,
    editableByRequester: false,
    description: "ObservaÃ§Ãµes iniciais do solicitante. Usar apenas como contexto.",
  },
  {
    field: "profileType",
    label: "Perfil",
    category: "registration",
    inputType: "select",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Perfil de acesso que serÃ¡ aplicado ao cadastro.",
  },
  {
    field: "company",
    label: "Empresa",
    category: "registration",
    inputType: "select",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Empresa vinculada ao usuÃ¡rio.",
  },
  {
    field: "fullName",
    label: "Nome completo",
    category: "registration",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Nome completo usado no cadastro.",
  },
  {
    field: "username",
    label: "UsuÃ¡rio sugerido",
    category: "registration",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Login sugerido para o usuÃ¡rio.",
  },
  {
    field: "email",
    label: "E-mail",
    category: "registration",
    inputType: "email",
    editableByReviewer: true,
    editableByRequester: true,
    description: "E-mail principal do cadastro.",
  },
  {
    field: "phone",
    label: "Telefone",
    category: "registration",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Telefone de contato.",
  },
  {
    field: "jobRole",
    label: "Cargo",
    category: "registration",
    inputType: "select",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Cargo ou funÃ§Ã£o informada para o cadastro.",
  },
  {
    field: "companyName",
    label: "RazÃ£o social",
    category: "company",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Nome da empresa solicitante.",
  },
  {
    field: "companyTaxId",
    label: "CNPJ",
    category: "company",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Documento fiscal da empresa.",
  },
  {
    field: "companyZip",
    label: "CEP",
    category: "company",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "CEP da empresa.",
  },
  {
    field: "companyAddress",
    label: "EndereÃ§o",
    category: "company",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "EndereÃ§o da empresa.",
  },
  {
    field: "companyPhone",
    label: "Telefone da empresa",
    category: "company",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Telefone institucional da empresa.",
  },
  {
    field: "companyWebsite",
    label: "Website",
    category: "company",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Site institucional da empresa.",
  },
  {
    field: "companyLinkedin",
    label: "LinkedIn",
    category: "company",
    inputType: "text",
    editableByReviewer: true,
    editableByRequester: true,
    description: "Perfil da empresa no LinkedIn.",
  },
  {
    field: "companyDescription",
    label: "DescriÃ§Ã£o da empresa",
    category: "company",
    inputType: "textarea",
    editableByReviewer: true,
    editableByRequester: true,
    description: "DescriÃ§Ã£o usada no cadastro da empresa.",
  },
  {
    field: "companyNotes",
    label: "ObservaÃ§Ãµes da empresa",
    category: "company",
    inputType: "textarea",
    editableByReviewer: true,
    editableByRequester: true,
    description: "ObservaÃ§Ãµes cadastrais da empresa.",
  },
];

export const ACCESS_REQUEST_CONTEXT_FIELD_OPTIONS = ACCESS_REQUEST_ADJUSTMENT_FIELD_DEFINITIONS.filter(
  (item) => item.category === "context",
);

export const ACCESS_REQUEST_BASE_ADJUSTMENT_OPTIONS = ACCESS_REQUEST_ADJUSTMENT_FIELD_DEFINITIONS.filter(
  (item) => item.category === "registration",
).map(({ field, label }) => ({ field, label }));

export const ACCESS_REQUEST_COMPANY_ADJUSTMENT_OPTIONS = ACCESS_REQUEST_ADJUSTMENT_FIELD_DEFINITIONS.filter(
  (item) => item.category === "company",
).map(({ field, label }) => ({ field, label }));

export const ACCESS_REQUEST_FORMAL_ADJUSTMENT_FIELDS = ACCESS_REQUEST_ADJUSTMENT_FIELD_DEFINITIONS.filter(
  (item) => item.category !== "context" && item.editableByRequester,
).map((item) => item.field);

export function getAccessRequestAdjustmentFieldDefinition(field: string) {
  return ACCESS_REQUEST_ADJUSTMENT_FIELD_DEFINITIONS.find((item) => item.field === field);
}

export function isAccessRequestContextField(field: string) {
  return getAccessRequestAdjustmentFieldDefinition(field)?.category === "context";
}

