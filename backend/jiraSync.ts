import "server-only";
import { prisma } from "@/database/prismaClient";
import { info, warn, error } from "@/backend/logger";

function buildBasicAuth(email: string, token: string) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

async function getCompanyJiraCredentials(slug: string) {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { jira_base_url: true, jira_email: true, jira_api_token: true },
  });
  if (!company) return null;
  const baseUrl = company.jira_base_url?.replace(/\/+$/, "") || null;
  const email = company.jira_email || null;
  const token = company.jira_api_token || null;
  if (!baseUrl || !email || !token) return null;
  return { baseUrl, email, token };
}

// Credenciais (token/base URL/e-mail) vivem na empresa — um site Jira Cloud por
// empresa. `projectKey` escopa a busca a um projeto Jira específico dentro desse
// site (mesmo modelo real do Jira: 1 site, N projetos identificados por key).
export async function fetchJiraIssuesForCompany(slug: string, maxResults = 50, projectKey?: string | null) {
  if (!slug) return { issues: [] };
  info(`fetchJiraIssuesForCompany start`, { company: slug, maxResults, projectKey: projectKey ?? null });
  const credentials = await getCompanyJiraCredentials(slug);
  if (!credentials) return { issues: [] };
  const { baseUrl, email, token } = credentials;

  const jql = projectKey
    ? `project = ${JSON.stringify(projectKey)} order by created DESC`
    : "order by created DESC";
  const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${Number(maxResults)}`;
  const res = await fetch(url, { headers: { Authorization: buildBasicAuth(email, token), Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return { issues: [] };
  const json = await res.json().catch(() => null);
  const issues = Array.isArray((json as any)?.issues) ? (json as any).issues : [];
  const mapped = issues.map((i: any) => ({
    id: i.id,
    key: i.key,
    summary: i.fields?.summary ?? null,
    status: i.fields?.status?.name ?? null,
    assignee: i.fields?.assignee?.displayName ?? null,
    created: i.fields?.created ?? null,
  }));
  info(`fetchJiraIssuesForCompany finished`, { company: slug, found: mapped.length });
  return { issues: mapped };
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function syncJiraIssuesToApplications(companySlug: string, maxResults = 50) {
  if (!companySlug) return [];
  info(`syncJiraIssuesToApplications start`, { company: companySlug, maxResults });
  const { issues } = await fetchJiraIssuesForCompany(companySlug, maxResults);
  if (!Array.isArray(issues) || issues.length === 0) return [];

  const synced: Array<Record<string, unknown>> = [];
  for (const i of issues) {
    const key = String(i.key ?? "");
    const summary = String(i.summary ?? key);
    const slug = normalizeSlug(`jira-${key}`);
    const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const up = await prisma.application.upsert({
        where: { slug_companySlug: { slug, companySlug } },
        create: { id, companyId: null, companySlug, name: summary, slug, description: `Imported from JIRA ${key}`, qaseProjectCode: null, source: "jira", active: true },
        update: { name: summary, description: `Imported from JIRA ${key}`, source: "jira", active: true },
      });
      synced.push({ id: up.id, slug: up.slug, name: up.name });
    } catch (e) {
      warn("syncJiraIssuesToApplications: individual upsert failed", { company: companySlug, key, error: String(e) });
    }
  }
  info(`syncJiraIssuesToApplications finished`, { company: companySlug, persisted: synced.length });
  return synced;
}

