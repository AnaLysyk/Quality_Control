import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { canManageInstitutionalCompanyAccess, resolveCurrentCompanyFromAccess } from "@/lib/companyProfileAccess";
import { validateJiraCloudCredentials } from "@/lib/jiraCloud";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!canManageInstitutionalCompanyAccess(access)) {
    return NextResponse.json({ error: "Sem permissão para validar a integração da empresa" }, { status: 403 });
  }

  const { company, status } = await resolveCurrentCompanyFromAccess(access);
  if (!company) {
    const message = status === 401 ? "Não autenticado" : status === 403 ? "Sem empresa vinculada" : "Empresa não encontrada";
    return NextResponse.json({ error: message }, { status });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const requestedBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
  const requestedEmail = typeof body?.email === "string" ? body.email.trim() : "";
  const requestedToken = typeof body?.token === "string" ? body.token.trim() : "";

  const baseUrl = requestedBaseUrl || (typeof company.jira_base_url === "string" ? company.jira_base_url.trim() : "");
  const email = requestedEmail || (typeof company.jira_email === "string" ? company.jira_email.trim() : "");
  const apiToken = requestedToken || (typeof company.jira_api_token === "string" ? company.jira_api_token.trim() : "");

  const result = await validateJiraCloudCredentials({ baseUrl, email, apiToken });
  if (!result.valid) {
    const statusCode = result.status && result.status >= 400 ? result.status : 400;
    return NextResponse.json({ error: result.errorMessage }, { status: statusCode });
  }

  return NextResponse.json(
    {
      valid: true,
      accountId: result.accountId,
      accountName: result.accountName,
      baseUrl: result.baseUrl,
    },
    { status: 200 },
  );
}
