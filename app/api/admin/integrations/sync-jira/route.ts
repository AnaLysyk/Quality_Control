import { NextResponse } from "next/server";
import "server-only";
import { resolveNormalizedCompanySlugs, resolvePrimaryCompanySlug } from "@/lib/auth/normalizeAuthenticatedUser";
import { authenticateRequest } from "@/lib/jwtAuth";
import { fetchJiraIssuesForCompany, syncJiraIssuesToApplications } from "@/lib/jiraSync";
import { info } from "@/lib/logger";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ success: false, error: { message: "Não autorizado" } }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const slug = typeof body.companySlug === "string" ? body.companySlug : null;
  if (!slug) return NextResponse.json({ success: false, error: { message: "companySlug ausente" } }, { status: 400 });

  // basic permission: allow global admins or users belonging to the same company
  const allowedSlugs = resolveNormalizedCompanySlugs(auth);
  const allowed = auth.isGlobalAdmin || resolvePrimaryCompanySlug(auth) === slug || allowedSlugs.includes(slug);
  if (!allowed) return NextResponse.json({ success: false, error: { message: "Sem permissão" } }, { status: 403 });

  info("admin:sync-jira triggered", { by: auth.id, company: slug });
  const out = await fetchJiraIssuesForCompany(slug, 50);
  const persisted = await syncJiraIssuesToApplications(slug, 50);
  info("admin:sync-jira finished", { by: auth.id, company: slug, preview: Array.isArray(out.issues) ? out.issues.length : 0, persisted: persisted.length });
  return NextResponse.json({ success: true, data: { preview: out, persisted } }, { status: 200 });
}
