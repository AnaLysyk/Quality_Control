import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { fetchJiraIssuesForCompany } from "@/backend/jiraSync";
import {
  canUseGlobalTestCaseScope,
  resolveAllowedProjectIds,
  resolveAllowedTestCaseCompanies,
} from "@/backend/test-cases/testCasePermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, jiraProjectKey: true, company: { select: { slug: true, jira_base_url: true } } },
  });
  if (!project) return NextResponse.json({ message: "Projeto não encontrado" }, { status: 404 });

  const companySlug = project.company.slug?.trim().toLowerCase();
  if (!canUseGlobalTestCaseScope(user)) {
    const allowedCompanies = resolveAllowedTestCaseCompanies(user);
    if (!companySlug || !allowedCompanies.includes(companySlug)) {
      return NextResponse.json({ message: "Projeto não encontrado" }, { status: 404 });
    }
    const allowedProjectIds = resolveAllowedProjectIds(user);
    if (allowedProjectIds && !allowedProjectIds.includes(project.id)) {
      return NextResponse.json({ message: "Projeto não encontrado" }, { status: 404 });
    }
  }

  if (!project.jiraProjectKey) {
    return NextResponse.json({ message: "Jira não configurado para este projeto" }, { status: 400 });
  }
  if (!companySlug) {
    return NextResponse.json({ message: "Empresa do projeto não encontrada" }, { status: 404 });
  }

  const url = new URL(req.url);
  const maxResults = Math.min(Number(url.searchParams.get("maxResults") ?? "50") || 50, 200);

  const { issues } = await fetchJiraIssuesForCompany(companySlug, maxResults, project.jiraProjectKey);
  const baseUrl = project.company.jira_base_url?.replace(/\/+$/, "") || null;
  return NextResponse.json({ issues, projectKey: project.jiraProjectKey, baseUrl });
}
