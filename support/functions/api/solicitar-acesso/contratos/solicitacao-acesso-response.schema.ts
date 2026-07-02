const statusSolicitacaoSchema = {
  type: "string",
  enum: [
    "pending",
    "under_review",
    "approved",
    "rejected",
    "cancelled",
    "expired",
    "needs_more_info",
  ],
} as const;

const tipoSolicitacaoSchema = {
  type: "string",
  enum: [
    "company_access",
    "company_user",
    "testing_company_user",
    "leader_tc",
    "technical_support",
    "company_creation",
    "profile_change",
    "permission_change",
    "company_link",
  ],
} as const;

const dataIsoSchema = {
  type: "string",
  format: "date-time",
} as const;

const campoAjusteSchema = {
  type: "string",
  enum: [
    "profileType",
    "company",
    "companyName",
    "companyTaxId",
    "companyZip",
    "companyAddress",
    "companyPhone",
    "companyWebsite",
    "companyLinkedin",
    "companyDescription",
    "companyNotes",
    "fullName",
    "username",
    "email",
    "phone",
    "jobRole",
    "title",
    "description",
    "notes",
    "password",
  ],
} as const;

export const criarSolicitacaoAcessoResponseSchema = {
  type: "object",
  required: ["ok", "message", "item"],
  properties: {
    ok: { const: true },
    message: { type: "string", minLength: 1 },
    item: {
      type: "object",
      required: [
        "id",
        "status",
        "requestType",
        "requesterEmail",
        "createdAt",
      ],
      properties: {
        id: { type: "string", minLength: 1 },
        status: statusSolicitacaoSchema,
        requestType: tipoSolicitacaoSchema,
        requestedRole: { type: "string", minLength: 1 },
        requestedCompanyId: { type: "string", minLength: 1 },
        requestedCompanySlug: { type: "string", minLength: 1 },
        requesterName: { type: "string", minLength: 1 },
        requesterEmail: { type: "string", format: "email" },
        createdAt: dataIsoSchema,
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
} as const;

export const solicitacaoAcessoDuplicadaResponseSchema = {
  type: "object",
  required: ["ok", "code", "message", "item"],
  properties: {
    ok: { const: false },
    code: { const: "DUPLICATE_ACCESS_REQUEST" },
    message: { type: "string", minLength: 1 },
    item: {
      type: "object",
      required: ["id", "status", "requesterEmail"],
      properties: {
        id: { type: "string", minLength: 1 },
        status: statusSolicitacaoSchema,
        requesterEmail: { type: "string", format: "email" },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
} as const;

export const consultarSolicitacaoAcessoResponseSchema = {
  type: "object",
  required: ["item", "comments"],
  properties: {
    item: {
      type: "object",
      required: [
        "id",
        "status",
        "requestType",
        "requesterEmail",
        "adjustmentFields",
        "adjustmentHistory",
        "lastAdjustmentDiff",
        "details",
        "priority",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        id: { type: "string", minLength: 1 },
        status: statusSolicitacaoSchema,
        requestType: tipoSolicitacaoSchema,
        requestedRole: { type: "string", minLength: 1 },
        requestedCompanyId: { type: "string", minLength: 1 },
        requestedCompanySlug: { type: "string", minLength: 1 },
        requesterName: { type: "string", minLength: 1 },
        requesterEmail: { type: "string", format: "email" },
        reason: { type: "string" },
        reviewComment: { type: "string" },
        adjustmentFields: {
          type: "array",
          items: campoAjusteSchema,
          uniqueItems: true,
        },
        adjustmentHistory: {
          type: "array",
          items: { type: "object" },
        },
        lastAdjustmentAt: dataIsoSchema,
        lastAdjustmentDiff: {
          type: "array",
          items: { type: "object" },
        },
        details: { type: "object" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
        },
        createdAt: dataIsoSchema,
        updatedAt: dataIsoSchema,
      },
      additionalProperties: true,
    },
    comments: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "authorRole", "authorName", "body", "createdAt"],
        properties: {
          id: { type: "string", minLength: 1 },
          authorRole: { type: "string", minLength: 1 },
          authorName: { type: "string", minLength: 1 },
          body: { type: "string", minLength: 1 },
          createdAt: dataIsoSchema,
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
} as const;

export const erroSolicitacaoAcessoResponseSchema = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string", minLength: 1 },
  },
  additionalProperties: true,
} as const;

