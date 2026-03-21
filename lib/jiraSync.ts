import "server-only";
import { getCompanyIntegrationConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prismaClient";
import { info, warn, error } from "@/lib/logger";

function buildBasicAuth(email: string, token: string) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

export async function fetchJiraIssuesForCompany(slug: string, maxResults = 50) {
  if (!slug) return { issues: [] };
  info(`fetchJiraIssuesForCompany start`, { company: slug, maxResults });
  const cfg = await getCompanyIntegrationConfig(slug, "JIRA");
  if (!cfg) return { issues: [] };

  const baseUrl = typeof cfg.baseUrl === "string" ? cfg.baseUrl.replace(/\/$/, "") : null;
  const email = typeof cfg.email === "string" ? cfg.email : null;
  const token = typeof cfg.token === "string" ? cfg.token : null;
  if (!baseUrl || !email || !token) return { issues: [] };

  const url = `${baseUrl}/rest/api/2/search?jql=order+by+created+DESC&maxResults=${Number(maxResults)}`;
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
