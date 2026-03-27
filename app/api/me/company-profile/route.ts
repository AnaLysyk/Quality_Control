import { NextRequest, NextResponse } from "next/server";

import { ClientCreateRequestSchema, ClientSchema } from "@/contracts/client";
import { syncCompanyApplications } from "@/lib/applicationsStore";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { createQaseClient, QaseError } from "@/lib/qaseSdk";
import {
  listLocalCompanies,
  updateLocalCompany,
} from "@/lib/auth/localStore";
import { getAccessContext } from "@/lib/auth/session";
import {
  areProjectCodesEqual,
  buildCompanyUpdatePatch,
  mapCompanyRecord,
  normalizeComparableName,
  normalizeTaxId,
} from "@/lib/companyRecord";
import {
  canManageInstitutionalCompanyAccess,
  resolveCurrentCompanyFromAccess,
} from "@/lib/companyProfileAccess";
import { validateJiraCloudCredentials } from "@/lib/jiraCloud";

export const runtime = "nodejs";
export const revalidate = 0;

async function resolveCurrentCompany(req: NextRequest) {
  const access = await getAccessContext(req);
  const { company, status } = await resolveCurrentCompanyFromAccess(access);
  return { access, company, status };
}

function hasOwn(body: unknown, key: string) {
  return Boolean(body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, key));
}

async function fetchAllQaseProjectCodes(input: {
  companySlug: string | null | undefined;
  token: string;
}) {
  const settings = input.companySlug ? await getClientQaseSettings(input.companySlug) : null;
  const client = createQaseClient({
    token: input.token,
    baseUrl: settings?.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io",
    defaultFetchOptions: { cache: "no-store" },
  });

  const items: string[] = [];
  let offset = 0;
  const pageLimit = 100;

  while (true) {
    const { data } = await client.getWithStatus<{ result?: { entities?: unknown[] } }>(`/project?limit=${pageLimit}&offset=${offset}`);
    const entities = Array.isArray(data.result?.entities) ? data.result.entities : [];
    const currentCodes = entities
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const record = item as Record<string, unknown>;
        const code =
          typeof record.code === "string"
            ? record.code.trim().toUpperCase()
            : typeof record.project === "string"
              ? record.project.trim().toUpperCase()
              : "";
        return code;
      })
      .filter(Boolean);

    if (currentCodes.length === 0) break;
    items.push(...currentCodes);
    if (currentCodes.length < pageLimit) break;
    offset += pageLimit;
  }

  return Array.from(new Set(items));
}

export async function GET(req: NextRequest) {
  const { company, status } = await resolveCurrentCompany(req);
  if (!company) {
    const message = status === 401 ? "Nao autenticado" : status === 403 ? "Sem empresa vinculada" : "Empresa nao encontrada";
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(ClientSchema.parse(mapCompanyRecord(company, { maskQaseToken: true, maskJiraToken: true })), { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const { access, company: current, status } = await resolveCurrentCompany(req);
  if (!current || !access) {
    const message = status === 401 ? "Nao autenticado" : status === 403 ? "Sem empresa vinculada" : "Empresa nao encontrada";
    return NextResponse.json({ error: message }, { status });
  }
  if (!canManageInstitutionalCompanyAccess(access)) {
    return NextResponse.json({ error: "Sem permissao para editar o perfil institucional da empresa" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ClientCreateRequestSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const input = parsed.data;
  const requestedIntegrationMode =
    input.integration_mode === "qase" || input.integration_mode === "jira" || input.integration_mode === "manual"
      ? input.integration_mode
      : null;
  const clearQaseToken = Boolean(body && typeof body === "object" && (body as Record<string, unknown>).clear_qase_token === true);
  const clearJiraApiToken = Boolean(body && typeof body === "object" && (body as Record<string, unknown>).clear_jira_api_token === true);
  const clearAllIntegrations = Boolean(body && typeof body === "object" && (body as Record<string, unknown>).clear_all_integrations === true);
  const companies = await listLocalCompanies();
  const nextName = (input.company_name ?? input.name ?? current.name ?? current.company_name ?? "").trim();
  if (!nextName) {
    return NextResponse.json({ error: "Nome da empresa obrigatorio" }, { status: 400 });
  }

  const duplicateByName = companies.find(
    (company) =>
      company.id !== current.id &&
      normalizeComparableName(company.name ?? company.company_name ?? "") === normalizeComparableName(nextName),
  );
  if (duplicateByName) {
    return NextResponse.json({ error: "Empresa ja cadastrada com esse nome" }, { status: 409 });
  }

  const nextTaxId = normalizeTaxId(
    typeof input.tax_id === "string" ? input.tax_id : typeof current.tax_id === "string" ? current.tax_id : null,
  );
  const duplicateByTaxId =
    nextTaxId.length > 0
      ? companies.find(
          (company) =>
            company.id !== current.id &&
            normalizeTaxId(typeof company.tax_id === "string" ? company.tax_id : null) === nextTaxId,
        )
      : null;
  if (duplicateByTaxId) {
    return NextResponse.json({ error: "CNPJ ja cadastrado para outra empresa" }, { status: 409 });
  }
  const qaseTouched =
    clearAllIntegrations ||
    clearQaseToken ||
    hasOwn(body, "qase_token") ||
    hasOwn(body, "qase_project_codes") ||
    (hasOwn(body, "integration_mode") && requestedIntegrationMode === "qase");
  const jiraTouched =
    clearAllIntegrations ||
    clearJiraApiToken ||
    hasOwn(body, "jira_base_url") ||
    hasOwn(body, "jira_email") ||
    hasOwn(body, "jira_api_token") ||
    (hasOwn(body, "integration_mode") && requestedIntegrationMode === "jira");

  const validationTimestamp = new Date().toISOString();
  const buildPatchResult = buildCompanyUpdatePatch(input, current, {
    clearQaseToken,
    clearJiraToken: clearJiraApiToken,
    clearAllIntegrations,
  });
  const { currentProjectCodes, nextProjectCodes, nextQaseToken, nextJiraBaseUrl, nextJiraEmail, nextJiraApiToken } = buildPatchResult;
  const normalizedNextQaseToken = typeof nextQaseToken === "string" ? nextQaseToken : null;
  const normalizedNextJiraBaseUrl = typeof nextJiraBaseUrl === "string" ? nextJiraBaseUrl : null;
  const normalizedNextJiraEmail = typeof nextJiraEmail === "string" ? nextJiraEmail : null;
  const normalizedNextJiraApiToken = typeof nextJiraApiToken === "string" ? nextJiraApiToken : null;

  let qaseValidation:
    | {
        status: "empty" | "pending" | "saved" | "active" | "error" | "pending_removal";
        isValid: boolean;
        isActive: boolean;
        validatedAt?: string | null;
        errorMessage?: string | null;
      }
    | null
    | undefined;
  let jiraValidation:
    | {
        status: "empty" | "pending" | "saved" | "active" | "error" | "pending_removal";
        isValid: boolean;
        isActive: boolean;
        validatedAt?: string | null;
        errorMessage?: string | null;
        accountName?: string | null;
      }
    | null
    | undefined;

  if (!clearAllIntegrations && qaseTouched) {
    const hasNextQaseToken = Boolean(normalizedNextQaseToken?.trim());
    const hasNextQaseProjects = Boolean(nextProjectCodes?.length);
    if (hasNextQaseToken || hasNextQaseProjects) {
      if (!hasNextQaseToken || !hasNextQaseProjects) {
        return NextResponse.json(
          { error: "A integracao da Qase so pode ser salva quando estiver ativa e valida, com token e projetos confirmados." },
          { status: 400 },
        );
      }
      try {
        const availableProjectCodes = await fetchAllQaseProjectCodes({
          companySlug: current.slug,
          token: normalizedNextQaseToken!,
        });
        const missingProject = (nextProjectCodes ?? []).find((code) => !availableProjectCodes.includes(code.trim().toUpperCase()));
        if (missingProject) {
          return NextResponse.json(
            { error: `Projeto da Qase invalido ou sem acesso: ${missingProject}. Revise o token e busque os projetos novamente.` },
            { status: 400 },
          );
        }
        qaseValidation = {
          status: "active",
          isValid: true,
          isActive: true,
          validatedAt: validationTimestamp,
          errorMessage: null,
        };
      } catch (error) {
        const message =
          error instanceof QaseError && (error.status === 401 || error.status === 403)
            ? "Token da Qase invalido ou sem acesso aos projetos selecionados."
            : "Nao foi possivel validar a integracao da Qase. Busque os projetos novamente antes de salvar.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  }

  if (!clearAllIntegrations && jiraTouched) {
    const hasAnyJiraConfig = Boolean(
      normalizedNextJiraBaseUrl?.trim() || normalizedNextJiraEmail?.trim() || normalizedNextJiraApiToken?.trim(),
    );
    if (hasAnyJiraConfig) {
      if (!normalizedNextJiraBaseUrl?.trim() || !normalizedNextJiraEmail?.trim() || !normalizedNextJiraApiToken?.trim()) {
        return NextResponse.json(
          { error: "A integracao do Jira so pode ser salva quando estiver ativa e valida, com URL, e-mail tecnico e API token." },
          { status: 400 },
        );
      }
      const jiraResult = await validateJiraCloudCredentials({
        baseUrl: normalizedNextJiraBaseUrl,
        email: normalizedNextJiraEmail,
        apiToken: normalizedNextJiraApiToken,
      });
      if (!jiraResult.valid) {
        return NextResponse.json({ error: jiraResult.errorMessage }, { status: 400 });
      }
      jiraValidation = {
        status: "active",
        isValid: true,
        isActive: true,
        validatedAt: validationTimestamp,
        errorMessage: null,
        accountName: jiraResult.accountName,
      };
    }
  }

  const { patch } = buildCompanyUpdatePatch(input, current, {
    clearQaseToken,
    clearJiraToken: clearJiraApiToken,
    clearAllIntegrations,
    qaseValidation,
    jiraValidation,
  });
  const updated = await updateLocalCompany(current.id, patch);

  if (!updated) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const projectCodesChanged = !areProjectCodesEqual(currentProjectCodes, nextProjectCodes);
  if (projectCodesChanged && nextProjectCodes?.length) {
    await syncCompanyApplications({
      companyId: updated.id,
      companySlug: updated.slug,
      projects: nextProjectCodes.map((code) => ({ code })),
      source: "qase",
    });
  }

  return NextResponse.json(ClientSchema.parse(mapCompanyRecord(updated, { maskQaseToken: true, maskJiraToken: true })), { status: 200 });
}
