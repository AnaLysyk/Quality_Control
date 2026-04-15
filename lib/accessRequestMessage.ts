import {
  normalizeRequestProfileType,
  resolveReviewQueue,
  toRequestProfileTypeLabel,
  type RequestProfileType,
  type ReviewQueue,
} from "@/lib/requestRouting";

export type AccessType = "testing_company_user" | "leader_tc" | "empresa" | "technical_support";
export type AccessTypeLabel =
  | "Usuarios Testing Company"
  | "Usuarios da empresa"
  | "Lider TC"
  | "Suporte Tecnico";

export type AccessRequestAdjustmentField =
  | "profileType"
  | "company"
  | "companyName"
  | "companyTaxId"
  | "companyZip"
  | "companyAddress"
  | "companyPhone"
  | "companyWebsite"
  | "companyLinkedin"
  | "companyDescription"
  | "companyNotes"
  | "fullName"
  | "name"
  | "username"
  | "email"
  | "phone"
  | "jobRole"
  | "title"
  | "description"
  | "notes"
  | "password";

export type AccessRequestAdjustmentEntry = {
  field: AccessRequestAdjustmentField;
  label: string;
  previous: string;
  next: string;
};

export type AccessRequestSnapshot = {
  email: string;
  name: string;
  fullName: string;
  username: string | null;
  phone: string;
  passwordHash: string | null;
  jobRole: string;
  company: string;
  clientId: string | null;
  accessType: AccessType;
  profileType: RequestProfileType;
  title: string;
  description: string;
  notes: string;
  companyProfile: AccessRequestCompanyProfile | null;
};

export type AccessRequestAdjustmentRound = {
  round: number;
  requestedAt: string;
  requestedFields: AccessRequestAdjustmentField[];
  requestMessage: string | null;
  requesterReturnedAt?: string | null;
  requesterDiff?: AccessRequestAdjustmentEntry[];
};

export type AccessRequestCompanyProfile = {
  companyName: string;
  companyTaxId: string;
  companyZip: string;
  companyAddress: string;
  companyPhone: string;
  companyWebsite: string;
  companyLinkedin: string;
  companyDescription: string;
  companyNotes: string;
};

export type ParsedAccessRequest = {
  email: string;
  name: string;
  fullName: string;
  username: string | null;
  phone: string;
  passwordHash: string | null;
  jobRole: string;
  company: string;
  clientId: string | null;
  accessType: AccessType;
  profileType: RequestProfileType;
  reviewQueue: ReviewQueue;
  title: string;
  description: string;
  notes: string;
  companyProfile: AccessRequestCompanyProfile | null;
  originalRequest: AccessRequestSnapshot;
  adjustmentRound: number;
  adjustmentRequestedFields: AccessRequestAdjustmentField[];
  adjustmentHistory: AccessRequestAdjustmentRound[];
  lastAdjustmentAt: string | null;
  lastAdjustmentDiff: AccessRequestAdjustmentEntry[];
};

type ComposeAccessRequestInput = {
  email: string;
  name: string;
  fullName?: string | null;
  username?: string | null;
  phone?: string | null;
  passwordHash?: string | null;
  role: string;
  company: string;
  clientId: string | null;
  accessType: AccessType;
  profileType: RequestProfileType;
  title: string;
  description: string;
  notes: string;
  companyProfile?: Partial<AccessRequestCompanyProfile> | null;
  adminNotes?: string | null;
  originalRequest?: AccessRequestSnapshot | null;
  adjustmentRound?: number;
  adjustmentRequestedFields?: AccessRequestAdjustmentField[];
  adjustmentHistory?: AccessRequestAdjustmentRound[];
  lastAdjustmentAt?: string | null;
  lastAdjustmentDiff?: AccessRequestAdjustmentEntry[];
};

function normalizeCompanyProfile(input?: Partial<AccessRequestCompanyProfile> | null): AccessRequestCompanyProfile | null {
  if (!input) return null;
  const profile: AccessRequestCompanyProfile = {
    companyName: typeof input.companyName === "string" ? input.companyName.trim() : "",
    companyTaxId: typeof input.companyTaxId === "string" ? input.companyTaxId.trim() : "",
    companyZip: typeof input.companyZip === "string" ? input.companyZip.trim() : "",
    companyAddress: typeof input.companyAddress === "string" ? input.companyAddress.trim() : "",
    companyPhone: typeof input.companyPhone === "string" ? input.companyPhone.trim() : "",
    companyWebsite: typeof input.companyWebsite === "string" ? input.companyWebsite.trim() : "",
    companyLinkedin: typeof input.companyLinkedin === "string" ? input.companyLinkedin.trim() : "",
    companyDescription: typeof input.companyDescription === "string" ? input.companyDescription.trim() : "",
    companyNotes: typeof input.companyNotes === "string" ? input.companyNotes.trim() : "",
  };
  return Object.values(profile).some(Boolean) ? profile : null;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSnapshot(input: AccessRequestSnapshot): AccessRequestSnapshot {
  return {
    email: input.email,
    name: input.name,
    fullName: input.fullName,
    username: input.username ?? null,
    phone: input.phone,
    passwordHash: input.passwordHash ?? null,
    jobRole: input.jobRole,
    company: input.company,
    clientId: input.clientId ?? null,
    accessType: input.accessType,
    profileType: input.profileType,
    title: input.title,
    description: input.description,
    notes: input.notes,
    companyProfile: normalizeCompanyProfile(input.companyProfile),
  };
}

function buildSnapshot(input: ComposeAccessRequestInput): AccessRequestSnapshot {
  return {
    email: input.email,
    name: input.name,
    fullName: input.fullName ?? input.name,
    username: input.username ?? null,
    phone: input.phone ?? "",
    passwordHash: input.passwordHash ?? null,
    jobRole: input.role,
    company: input.company,
    clientId: input.clientId ?? null,
    accessType: input.accessType,
    profileType: input.profileType,
    title: input.title || "",
    description: input.description || "",
    notes: input.notes || "",
    companyProfile: normalizeCompanyProfile(input.companyProfile),
  };
}

function normalizeAdjustmentFields(input: unknown): AccessRequestAdjustmentField[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean) as AccessRequestAdjustmentField[];
}

function normalizeAdjustmentHistory(input: unknown): AccessRequestAdjustmentRound[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const round = typeof record.round === "number" ? record.round : Number(record.round ?? 0);
      const requestedAt = typeof record.requestedAt === "string" ? record.requestedAt : "";
      if (!round || !requestedAt) return null;
      return {
        round,
        requestedAt,
        requestedFields: normalizeAdjustmentFields(record.requestedFields),
        requestMessage: typeof record.requestMessage === "string" ? record.requestMessage : null,
        requesterReturnedAt: typeof record.requesterReturnedAt === "string" ? record.requesterReturnedAt : null,
        requesterDiff: Array.isArray(record.requesterDiff)
          ? record.requesterDiff
              .map((diffEntry) => {
                const diffRecord = diffEntry as Record<string, unknown>;
                return {
                  field: typeof diffRecord.field === "string" ? (diffRecord.field as AccessRequestAdjustmentField) : "notes",
                  label: typeof diffRecord.label === "string" ? diffRecord.label : "Campo",
                  previous: typeof diffRecord.previous === "string" ? diffRecord.previous : "",
                  next: typeof diffRecord.next === "string" ? diffRecord.next : "",
                } satisfies AccessRequestAdjustmentEntry;
              })
              .filter((diffEntry) => diffEntry.label)
          : [],
      } satisfies AccessRequestAdjustmentRound;
    })
    .filter((entry) => entry !== null) as AccessRequestAdjustmentRound[];
}

export function toAccessTypeLabel(accessType: AccessType): AccessTypeLabel {
  if (accessType === "leader_tc") return "Lider TC";
  if (accessType === "empresa") return "Usuarios da empresa";
  if (accessType === "technical_support") return "Suporte Tecnico";
  return "Usuarios Testing Company";
}

export function normalizeAccessType(value: string | null | undefined): AccessType | null {
  if (!value) return null;
  const v = normalizeText(value);
  if (
    v === "usuario da empresa" ||
    v === "usuario" ||
    v === "user" ||
    v === "common" ||
    v === "testing_company_user" ||
    v === "testing company user"
  ) {
    return "testing_company_user";
  }
  if (v === "admin do sistema" || v === "administrador do sistema" || v === "administrador" || v === "admin" || v === "leader_tc" || v === "lider tc") {
    return "leader_tc";
  }
  if (v === "admin da empresa" || v === "administrador da empresa" || v === "empresa" || v === "company") {
    return "empresa";
  }
  if (v === "global" || v === "desenvolvedor global" || v === "perfil global" || v === "technical_support" || v === "suporte tecnico") {
    return "technical_support";
  }
  return null;
}

export function extractAdminNotes(message: string): string | null {
  const line = message.split("\n").find((l) => l.startsWith("ADMIN_NOTES:"));
  if (!line) return null;
  const notes = line.slice("ADMIN_NOTES:".length).trim();
  return notes || null;
}

export function composeAccessRequestMessage(input: ComposeAccessRequestInput): string {
  const reviewQueue = resolveReviewQueue(input.profileType);
  const companyProfile = normalizeCompanyProfile(input.companyProfile);
  const snapshot = buildSnapshot(input);
  const originalRequest = normalizeSnapshot(input.originalRequest ?? snapshot);
  const payload = {
    v: 1,
    kind: "access_request",
    email: input.email,
    name: input.name,
    fullName: input.fullName ?? input.name,
    username: input.username ?? null,
    phone: input.phone ?? null,
    passwordHash: input.passwordHash ?? null,
    jobRole: input.role,
    company: input.company,
    clientId: input.clientId,
    accessType: input.accessType,
    profileType: input.profileType,
    reviewQueue,
    mappedAppRole: input.accessType,
    title: input.title || null,
    description: input.description || null,
    notes: input.notes || null,
    companyProfile,
    originalRequest,
    adjustmentRound: typeof input.adjustmentRound === "number" ? input.adjustmentRound : 0,
    adjustmentRequestedFields: normalizeAdjustmentFields(input.adjustmentRequestedFields),
    adjustmentHistory: normalizeAdjustmentHistory(input.adjustmentHistory),
    lastAdjustmentAt: input.lastAdjustmentAt ?? null,
    lastAdjustmentDiff: Array.isArray(input.lastAdjustmentDiff) ? input.lastAdjustmentDiff : [],
  };

  const lines = [
    `ACCESS_REQUEST_V1 ${JSON.stringify(payload)}`,
    "Solicitacao de acesso registrada",
    input.title ? `Titulo da solicitacao: ${input.title}` : "",
    input.description ? `Descricao detalhada: ${input.description}` : "",
    `Tipo de perfil: ${toRequestProfileTypeLabel(input.profileType)}`,
    `Destino da fila: ${reviewQueue === "global_only" ? "Global" : "Admin e Global"}`,
    `Tipo de acesso interno: ${toAccessTypeLabel(input.accessType)}`,
    `Empresa: ${input.company}${input.clientId ? ` (id: ${input.clientId})` : ""}`,
    companyProfile?.companyName ? `Empresa solicitada: ${companyProfile.companyName}` : "",
    companyProfile?.companyTaxId ? `CNPJ: ${companyProfile.companyTaxId}` : "",
    companyProfile?.companyZip ? `CEP: ${companyProfile.companyZip}` : "",
    companyProfile?.companyAddress ? `Endereco: ${companyProfile.companyAddress}` : "",
    companyProfile?.companyPhone ? `Telefone da empresa: ${companyProfile.companyPhone}` : "",
    companyProfile?.companyWebsite ? `Website: ${companyProfile.companyWebsite}` : "",
    companyProfile?.companyLinkedin ? `LinkedIn: ${companyProfile.companyLinkedin}` : "",
    companyProfile?.companyDescription ? `Descricao da empresa: ${companyProfile.companyDescription}` : "",
    companyProfile?.companyNotes ? `Observacoes da empresa: ${companyProfile.companyNotes}` : "",
    `Cargo: ${input.role}`,
    `Nome completo: ${input.fullName ?? input.name}`,
    input.username ? `Usuario: ${input.username}` : "",
    input.phone ? `Telefone: ${input.phone}` : "",
    `Email: ${input.email}`,
    input.notes ? `Observacoes: ${input.notes}` : "",
  ].filter(Boolean);

  if (input.adminNotes && input.adminNotes.trim()) {
    lines.push(`ADMIN_NOTES: ${input.adminNotes.trim()}`);
  }

  return lines.join("\n");
}

export function parseAccessRequestMessage(message: string, fallbackEmail: string): ParsedAccessRequest {
  const prefix = "ACCESS_REQUEST_V1 ";
  const line = message.split("\n").find((l) => l.startsWith(prefix));
  if (line) {
    try {
      const json = JSON.parse(line.slice(prefix.length)) as Record<string, unknown>;
      return {
        email: typeof json.email === "string" ? json.email : fallbackEmail,
        name: typeof json.name === "string" ? json.name : "",
        fullName: typeof json.fullName === "string" ? json.fullName : typeof json.name === "string" ? json.name : "",
        username: typeof json.username === "string" ? json.username : null,
        phone: typeof json.phone === "string" ? json.phone : "",
        passwordHash: typeof json.passwordHash === "string" ? json.passwordHash : null,
        jobRole: typeof json.jobRole === "string" ? json.jobRole : "",
        company: typeof json.company === "string" ? json.company : "",
        clientId: typeof json.clientId === "string" ? json.clientId : null,
        accessType: normalizeAccessType(typeof json.accessType === "string" ? json.accessType : "") ?? "testing_company_user",
        profileType:
          normalizeRequestProfileType(typeof json.profileType === "string" ? json.profileType : "") ??
          normalizeRequestProfileType(typeof json.accessType === "string" ? json.accessType : "") ??
          "testing_company_user",
        reviewQueue:
          (typeof json.reviewQueue === "string" && (json.reviewQueue === "admin_and_global" || json.reviewQueue === "global_only")
            ? json.reviewQueue
            : null) ??
          resolveReviewQueue(
            normalizeRequestProfileType(typeof json.profileType === "string" ? json.profileType : "") ??
              normalizeRequestProfileType(typeof json.accessType === "string" ? json.accessType : "") ??
              "testing_company_user",
          ),
        title: typeof json.title === "string" ? json.title : "",
        description: typeof json.description === "string" ? json.description : "",
        notes: typeof json.notes === "string" ? json.notes : "",
        companyProfile: normalizeCompanyProfile(
          typeof json.companyProfile === "object" && json.companyProfile !== null
            ? (json.companyProfile as Partial<AccessRequestCompanyProfile>)
            : null,
        ),
        originalRequest: normalizeSnapshot(
          typeof json.originalRequest === "object" && json.originalRequest !== null
            ? ({
                email: typeof (json.originalRequest as Record<string, unknown>).email === "string" ? ((json.originalRequest as Record<string, unknown>).email as string) : fallbackEmail,
                name: typeof (json.originalRequest as Record<string, unknown>).name === "string" ? ((json.originalRequest as Record<string, unknown>).name as string) : "",
                fullName:
                  typeof (json.originalRequest as Record<string, unknown>).fullName === "string"
                    ? ((json.originalRequest as Record<string, unknown>).fullName as string)
                    : typeof (json.originalRequest as Record<string, unknown>).name === "string"
                      ? ((json.originalRequest as Record<string, unknown>).name as string)
                      : "",
                username: typeof (json.originalRequest as Record<string, unknown>).username === "string" ? ((json.originalRequest as Record<string, unknown>).username as string) : null,
                phone: typeof (json.originalRequest as Record<string, unknown>).phone === "string" ? ((json.originalRequest as Record<string, unknown>).phone as string) : "",
                passwordHash:
                  typeof (json.originalRequest as Record<string, unknown>).passwordHash === "string"
                    ? ((json.originalRequest as Record<string, unknown>).passwordHash as string)
                    : null,
                jobRole: typeof (json.originalRequest as Record<string, unknown>).jobRole === "string" ? ((json.originalRequest as Record<string, unknown>).jobRole as string) : "",
                company: typeof (json.originalRequest as Record<string, unknown>).company === "string" ? ((json.originalRequest as Record<string, unknown>).company as string) : "",
                clientId: typeof (json.originalRequest as Record<string, unknown>).clientId === "string" ? ((json.originalRequest as Record<string, unknown>).clientId as string) : null,
                accessType: normalizeAccessType(typeof (json.originalRequest as Record<string, unknown>).accessType === "string" ? ((json.originalRequest as Record<string, unknown>).accessType as string) : "") ?? "testing_company_user",
                profileType:
                  normalizeRequestProfileType(
                    typeof (json.originalRequest as Record<string, unknown>).profileType === "string"
                      ? ((json.originalRequest as Record<string, unknown>).profileType as string)
                      : "",
                  ) ?? "testing_company_user",
                title: typeof (json.originalRequest as Record<string, unknown>).title === "string" ? ((json.originalRequest as Record<string, unknown>).title as string) : "",
                description: typeof (json.originalRequest as Record<string, unknown>).description === "string" ? ((json.originalRequest as Record<string, unknown>).description as string) : "",
                notes: typeof (json.originalRequest as Record<string, unknown>).notes === "string" ? ((json.originalRequest as Record<string, unknown>).notes as string) : "",
                companyProfile: normalizeCompanyProfile(
                  typeof (json.originalRequest as Record<string, unknown>).companyProfile === "object" &&
                    (json.originalRequest as Record<string, unknown>).companyProfile !== null
                    ? ((json.originalRequest as Record<string, unknown>).companyProfile as Partial<AccessRequestCompanyProfile>)
                    : null,
                ),
              } satisfies AccessRequestSnapshot)
            : {
                email: typeof json.email === "string" ? json.email : fallbackEmail,
                name: typeof json.name === "string" ? json.name : "",
                fullName:
                  typeof json.fullName === "string" ? json.fullName : typeof json.name === "string" ? json.name : "",
                username: typeof json.username === "string" ? json.username : null,
                phone: typeof json.phone === "string" ? json.phone : "",
                passwordHash: typeof json.passwordHash === "string" ? json.passwordHash : null,
                jobRole: typeof json.jobRole === "string" ? json.jobRole : "",
                company: typeof json.company === "string" ? json.company : "",
                clientId: typeof json.clientId === "string" ? json.clientId : null,
                accessType: normalizeAccessType(typeof json.accessType === "string" ? json.accessType : "") ?? "testing_company_user",
                profileType:
                  normalizeRequestProfileType(typeof json.profileType === "string" ? json.profileType : "") ??
                  "testing_company_user",
                title: typeof json.title === "string" ? json.title : "",
                description: typeof json.description === "string" ? json.description : "",
                notes: typeof json.notes === "string" ? json.notes : "",
                companyProfile: normalizeCompanyProfile(
                  typeof json.companyProfile === "object" && json.companyProfile !== null
                    ? (json.companyProfile as Partial<AccessRequestCompanyProfile>)
                    : null,
                ),
              },
        ),
        adjustmentRound: typeof json.adjustmentRound === "number" ? json.adjustmentRound : Number(json.adjustmentRound ?? 0) || 0,
        adjustmentRequestedFields: normalizeAdjustmentFields(json.adjustmentRequestedFields),
        adjustmentHistory: normalizeAdjustmentHistory(json.adjustmentHistory),
        lastAdjustmentAt: typeof json.lastAdjustmentAt === "string" ? json.lastAdjustmentAt : null,
        lastAdjustmentDiff: Array.isArray(json.lastAdjustmentDiff)
          ? json.lastAdjustmentDiff
              .map((entry) => {
                const record = entry as Record<string, unknown>;
                return {
                  field: typeof record.field === "string" ? (record.field as AccessRequestAdjustmentField) : "notes",
                  label: typeof record.label === "string" ? record.label : "Campo",
                  previous: typeof record.previous === "string" ? record.previous : "",
                  next: typeof record.next === "string" ? record.next : "",
                } satisfies AccessRequestAdjustmentEntry;
              })
              .filter((entry) => entry.label)
          : [],
      };
    } catch {
      // fallthrough
    }
  }

  const lines = message.split("\n").map((l) => l.trim());
  const find = (label: string) => {
    const hit = lines.find((l) => normalizeText(l).startsWith(normalizeText(label) + ":"));
    return hit ? hit.slice(label.length + 1).trim() : "";
  };

  return {
    email: fallbackEmail,
    name: find("Nome"),
    fullName: find("Nome completo") || find("Nome"),
    username: find("Usuario") || null,
    phone: find("Telefone"),
    passwordHash: null,
    jobRole: find("Cargo"),
    company: find("Empresa"),
    clientId: null,
    accessType: normalizeAccessType(find("Tipo de acesso")) ?? "testing_company_user",
    profileType:
      normalizeRequestProfileType(find("Tipo de perfil")) ??
      normalizeRequestProfileType(find("Tipo de acesso")) ??
      "testing_company_user",
    reviewQueue: resolveReviewQueue(
      normalizeRequestProfileType(find("Tipo de perfil")) ??
        normalizeRequestProfileType(find("Tipo de acesso")) ??
        "testing_company_user",
    ),
    title: find("Titulo da solicitacao") || find("Titulo"),
    description: find("Descricao detalhada") || find("Descricao") || find("Mensagem"),
    notes: find("Observacoes") || find("Mensagem"),
    companyProfile: normalizeCompanyProfile({
      companyName: find("Empresa solicitada"),
      companyTaxId: find("CNPJ"),
      companyZip: find("CEP"),
      companyAddress: find("Endereco"),
      companyPhone: find("Telefone da empresa"),
      companyWebsite: find("Website"),
      companyLinkedin: find("LinkedIn"),
      companyDescription: find("Descricao da empresa"),
      companyNotes: find("Observacoes da empresa"),
    }),
    originalRequest: {
      email: fallbackEmail,
      name: find("Nome"),
      fullName: find("Nome completo") || find("Nome"),
      username: find("Usuario") || null,
      phone: find("Telefone"),
      passwordHash: null,
      jobRole: find("Cargo"),
      company: find("Empresa"),
      clientId: null,
      accessType: normalizeAccessType(find("Tipo de acesso")) ?? "testing_company_user",
      profileType:
        normalizeRequestProfileType(find("Tipo de perfil")) ??
        normalizeRequestProfileType(find("Tipo de acesso")) ??
        "testing_company_user",
      title: find("Titulo da solicitacao") || find("Titulo"),
      description: find("Descricao detalhada") || find("Descricao") || find("Mensagem"),
      notes: find("Observacoes") || find("Mensagem"),
      companyProfile: normalizeCompanyProfile({
        companyName: find("Empresa solicitada"),
        companyTaxId: find("CNPJ"),
        companyZip: find("CEP"),
        companyAddress: find("Endereco"),
        companyPhone: find("Telefone da empresa"),
        companyWebsite: find("Website"),
        companyLinkedin: find("LinkedIn"),
        companyDescription: find("Descricao da empresa"),
        companyNotes: find("Observacoes da empresa"),
      }),
    },
    adjustmentRound: 0,
    adjustmentRequestedFields: [],
    adjustmentHistory: [],
    lastAdjustmentAt: null,
    lastAdjustmentDiff: [],
  };
}

export { toRequestProfileTypeLabel };
