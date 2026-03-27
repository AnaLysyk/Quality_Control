import type { ClientCreateRequest } from "@/contracts/client";
import type { LocalAuthCompany } from "@/lib/auth/localStore";
import { maskQaseToken, maskStoredSecret } from "@/lib/qaseTokenMask";

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asValidationStatus(value: unknown):
  | "empty"
  | "pending"
  | "saved"
  | "active"
  | "error"
  | "pending_removal"
  | null {
  if (
    value === "empty" ||
    value === "pending" ||
    value === "saved" ||
    value === "active" ||
    value === "error" ||
    value === "pending_removal"
  ) {
    return value;
  }
  return null;
}

function findIntegrationConfig(company: LocalAuthCompany, type: "QASE" | "JIRA") {
  const integrations = Array.isArray((company as { integrations?: unknown }).integrations)
    ? ((company as { integrations?: Array<{ type?: unknown; config?: unknown }> }).integrations ?? [])
    : [];
  const match = integrations.find((integration) => String(integration?.type ?? "").toUpperCase() === type);
  if (!match?.config || typeof match.config !== "object") return null;
  return match.config as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return items.length ? items : null;
}

export function normalizeProjectCodes(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    return items.length ? Array.from(new Set(items)) : null;
  }
  if (typeof value === "string") {
    const items = value
      .split(/[\s,;|]+/g)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    return items.length ? Array.from(new Set(items)) : null;
  }
  return null;
}

export function normalizeComparableName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

export function areProjectCodesEqual(left: string[] | null, right: string[] | null) {
  const normalizedLeft = (left ?? []).map((item) => item.trim().toUpperCase()).filter(Boolean).sort();
  const normalizedRight = (right ?? []).map((item) => item.trim().toUpperCase()).filter(Boolean).sort();
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export function mapCompanyRecord(
  company: LocalAuthCompany,
  options?: { maskQaseToken?: boolean; maskJiraToken?: boolean },
) {
  const qaseConfig = findIntegrationConfig(company, "QASE");
  const jiraConfig = findIntegrationConfig(company, "JIRA");
  const legacyPrimaryProject =
    typeof (company as { qase_project_code?: unknown }).qase_project_code === "string"
      ? ((company as { qase_project_code?: string | null }).qase_project_code ?? null)
      : null;
  const qaseProjectCodes =
    asStringArray(company.qase_project_codes) ??
    normalizeProjectCodes(qaseConfig?.projects) ??
    normalizeProjectCodes(legacyPrimaryProject);
  const rawQaseToken = asString(company.qase_token) ?? asString(qaseConfig?.token);
  const rawJiraApiToken = asString(company.jira_api_token) ?? asString(jiraConfig?.apiToken);
  const rawJiraBaseUrl = asString(company.jira_base_url) ?? asString(jiraConfig?.baseUrl);
  const rawJiraEmail = asString(company.jira_email) ?? asString(jiraConfig?.email);
  const qaseValidationStatus = asValidationStatus(qaseConfig?.validationStatus);
  const qaseHasCompleteConfig = Boolean(rawQaseToken?.trim()) && Boolean(qaseProjectCodes?.length);
  const resolvedQaseValidationStatus =
    qaseValidationStatus ?? (qaseHasCompleteConfig ? "active" : rawQaseToken?.trim() || qaseProjectCodes?.length ? "saved" : "empty");
  const qaseIsValid = asBoolean(qaseConfig?.isValid) ?? (resolvedQaseValidationStatus === "active");
  const qaseIsActive = asBoolean(qaseConfig?.isActive) ?? (resolvedQaseValidationStatus === "active");
  const jiraValidationStatus = asValidationStatus(jiraConfig?.validationStatus);
  const jiraHasCompleteConfig = Boolean(rawJiraBaseUrl?.trim() && rawJiraEmail?.trim() && rawJiraApiToken?.trim());
  const jiraHasPartialConfig = Boolean(rawJiraBaseUrl?.trim() || rawJiraEmail?.trim() || rawJiraApiToken?.trim());
  const resolvedJiraValidationStatus =
    jiraValidationStatus ?? (jiraHasCompleteConfig ? "active" : jiraHasPartialConfig ? "saved" : "empty");
  const jiraIsValid = asBoolean(jiraConfig?.isValid) ?? (resolvedJiraValidationStatus === "active");
  const jiraIsActive = asBoolean(jiraConfig?.isActive) ?? (resolvedJiraValidationStatus === "active");

  return {
    id: company.id,
    name: (company.name ?? company.company_name ?? "").toString(),
    company_name: (company.company_name ?? company.name ?? "").toString(),
    slug: company.slug,
    tax_id: asString(company.tax_id),
    address: asString(company.address),
    phone: asString(company.phone),
    website: asString(company.website),
    logo_url: asString(company.logo_url),
    docs_link: asString(company.docs_link ?? company.docs_url),
    notes: asString(company.notes ?? company.description),
    cep: asString(company.cep),
    address_detail: asString(company.address_detail),
    linkedin_url: asString(company.linkedin_url),
    qase_project_code: qaseProjectCodes?.[0] ?? legacyPrimaryProject,
    qase_project_codes: qaseProjectCodes,
    qase_token: options?.maskQaseToken ? null : rawQaseToken,
    has_qase_token: Boolean(rawQaseToken?.trim()),
    qase_token_masked: options?.maskQaseToken ? maskQaseToken(rawQaseToken) : null,
    qase_validation_status: resolvedQaseValidationStatus,
    qase_is_valid: qaseIsValid,
    qase_is_active: qaseIsActive,
    qase_validated_at: asString(qaseConfig?.validatedAt),
    jira_base_url: rawJiraBaseUrl,
    jira_email: rawJiraEmail,
    jira_username: asString(company.jira_username),
    jira_api_token: options?.maskJiraToken ? null : rawJiraApiToken,
    has_jira_api_token: Boolean(rawJiraApiToken?.trim()),
    jira_api_token_masked: options?.maskJiraToken ? maskStoredSecret(rawJiraApiToken) : null,
    jira_validation_status: resolvedJiraValidationStatus,
    jira_is_valid: jiraIsValid,
    jira_is_active: jiraIsActive,
    jira_validated_at: asString(jiraConfig?.validatedAt),
    jira_account_name: asString(jiraConfig?.accountName),
    integration_mode: asString(company.integration_mode),
    integration_type: asString((company as { integration_type?: unknown }).integration_type),
    integrations: Array.isArray((company as { integrations?: unknown }).integrations)
      ? ((company as { integrations?: Array<{ id?: string; type: string; config?: Record<string, unknown>; createdAt?: string }> }).integrations ?? []).map(
          (integration) => ({
            id: integration.id ?? undefined,
            type: integration.type as "QASE" | "JIRA" | "MANUAL" | "OTHER",
            config: integration.config ?? undefined,
            createdAt: integration.createdAt ?? undefined,
          }),
        )
      : undefined,
    short_description: asString(company.short_description),
    internal_notes: asString(company.internal_notes),
    extra_notes: asString(company.extra_notes),
    status: asString(company.status),
    active: company.active ?? true,
    updated_at: asString(company.updated_at),
    created_at: asString(company.created_at),
    created_by: asString(company.created_by),
  };
}

export function buildCompanyUpdatePatch(
  input: ClientCreateRequest,
  current: LocalAuthCompany,
  options?: {
    clearQaseToken?: boolean;
    clearJiraToken?: boolean;
    clearAllIntegrations?: boolean;
    qaseValidation?: {
      status: "empty" | "pending" | "saved" | "active" | "error" | "pending_removal";
      isValid: boolean;
      isActive: boolean;
      validatedAt?: string | null;
      errorMessage?: string | null;
    } | null;
    jiraValidation?: {
      status: "empty" | "pending" | "saved" | "active" | "error" | "pending_removal";
      isValid: boolean;
      isActive: boolean;
      validatedAt?: string | null;
      errorMessage?: string | null;
      accountName?: string | null;
    } | null;
  },
) {
  const nextName = (input.company_name ?? input.name ?? current.name ?? current.company_name ?? "").trim();
  const currentQaseConfig = findIntegrationConfig(current, "QASE");
  const currentJiraConfig = findIntegrationConfig(current, "JIRA");
  const legacyCurrentProjectCodes = normalizeProjectCodes((current as { qase_project_code?: unknown }).qase_project_code);
  const currentProjectCodes =
    normalizeProjectCodes(current.qase_project_codes) ??
    normalizeProjectCodes(currentQaseConfig?.projects) ??
    legacyCurrentProjectCodes;
  const currentQaseToken = asString(current.qase_token) ?? asString(currentQaseConfig?.token);
  const currentJiraBaseUrl = asString(current.jira_base_url) ?? asString(currentJiraConfig?.baseUrl);
  const currentJiraEmail = asString(current.jira_email) ?? asString(currentJiraConfig?.email);
  const currentJiraApiToken = asString(current.jira_api_token) ?? asString(currentJiraConfig?.apiToken);
  const hasQaseProjectCodesInput = Object.prototype.hasOwnProperty.call(input, "qase_project_codes");
  const parsedNextProjectCodes = normalizeProjectCodes(input.qase_project_codes);
  const nextProjectCodes = options?.clearAllIntegrations
    ? []
    : hasQaseProjectCodesInput
      ? parsedNextProjectCodes ?? []
      : currentProjectCodes;
  const nextQaseToken = options?.clearAllIntegrations
    ? null
    : options?.clearQaseToken
      ? null
      : input.qase_token ?? currentQaseToken ?? null;
  const nextJiraBaseUrl = options?.clearAllIntegrations ? null : input.jira_base_url ?? currentJiraBaseUrl ?? null;
  const nextJiraEmail = options?.clearAllIntegrations ? null : input.jira_email ?? currentJiraEmail ?? null;
  const nextJiraApiToken = options?.clearAllIntegrations
    ? null
    : options?.clearJiraToken
      ? null
      : input.jira_api_token ?? currentJiraApiToken ?? null;
  const nextIntegrationMode =
    options?.clearAllIntegrations
      ? "manual"
      : input.integration_mode ??
        current.integration_mode ??
        (nextQaseToken || nextProjectCodes?.length ? "qase" : nextJiraBaseUrl || nextJiraEmail || nextJiraApiToken ? "jira" : "manual");

  const integrations: Array<{ type: "QASE" | "JIRA" | "MANUAL" | "OTHER"; config?: Record<string, unknown> }> = [];
  if (nextQaseToken || (Array.isArray(nextProjectCodes) && nextProjectCodes.length)) {
    integrations.push({
      type: "QASE",
      config: {
        ...(currentQaseConfig ?? {}),
        token: nextQaseToken,
        projects: nextProjectCodes ?? [],
        ...(options?.qaseValidation
          ? {
              validationStatus: options.qaseValidation.status,
              isValid: options.qaseValidation.isValid,
              isActive: options.qaseValidation.isActive,
              validatedAt: options.qaseValidation.validatedAt ?? null,
              errorMessage: options.qaseValidation.errorMessage ?? null,
            }
          : {}),
      },
    });
  }
  if (nextJiraApiToken || nextJiraBaseUrl || nextJiraEmail) {
    integrations.push({
      type: "JIRA",
      config: {
        ...(currentJiraConfig ?? {}),
        baseUrl: nextJiraBaseUrl,
        email: nextJiraEmail,
        apiToken: nextJiraApiToken,
        ...(options?.jiraValidation
          ? {
              validationStatus: options.jiraValidation.status,
              isValid: options.jiraValidation.isValid,
              isActive: options.jiraValidation.isActive,
              validatedAt: options.jiraValidation.validatedAt ?? null,
              errorMessage: options.jiraValidation.errorMessage ?? null,
              accountName: options.jiraValidation.accountName ?? null,
            }
          : {}),
      },
    });
  }

  return {
    nextName,
    currentProjectCodes,
    nextProjectCodes,
    nextQaseToken,
    nextIntegrationMode,
    patch: {
      name: nextName,
      company_name: input.company_name ?? input.name ?? nextName,
      tax_id: input.tax_id ?? current.tax_id ?? null,
      address: input.address ?? current.address ?? null,
      phone: input.phone ?? current.phone ?? null,
      website: input.website ?? current.website ?? null,
      logo_url: input.logo_url ?? current.logo_url ?? null,
      docs_link: input.docs_link ?? current.docs_link ?? current.docs_url ?? null,
      notes:
        input.notes ??
        input.internal_notes ??
        input.extra_notes ??
        input.description ??
        input.short_description ??
        current.notes ??
        current.description ??
        null,
      cep: input.cep ?? current.cep ?? null,
      address_detail: input.address_detail ?? current.address_detail ?? null,
      linkedin_url: input.linkedin_url ?? current.linkedin_url ?? null,
      qase_project_code: nextProjectCodes?.[0] ?? null,
      qase_project_codes: nextProjectCodes,
      qase_token: nextQaseToken,
      jira_base_url: nextJiraBaseUrl,
      jira_email: nextJiraEmail,
      jira_api_token: nextJiraApiToken,
      integration_mode: nextIntegrationMode,
      integration_type: nextIntegrationMode,
      integrations,
      status: input.status ?? (input.active === false ? "inactive" : input.active === true ? "active" : current.status ?? "active"),
      active: typeof input.active === "boolean" ? input.active : current.active ?? true,
      updated_at: new Date().toISOString(),
    } satisfies Partial<LocalAuthCompany>,
    nextJiraBaseUrl,
    nextJiraEmail,
    nextJiraApiToken,
  };
}
