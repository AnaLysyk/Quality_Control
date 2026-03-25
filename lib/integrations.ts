import "server-only";

import { findLocalCompanyBySlug } from "@/lib/auth/localStore";

export type CompanyIntegrationRecord = { id?: string; type: string; config?: Record<string, unknown> | null; createdAt?: string };

export async function getCompanyIntegrationsBySlug(slug: string): Promise<CompanyIntegrationRecord[]> {
  if (!slug) return [];
  const company = await findLocalCompanyBySlug(slug);
  if (!company) return [];
  const integrations = Array.isArray((company as any).integrations) ? (company as any).integrations : [];
  return integrations.map((it: any) => ({ id: it.id ?? undefined, type: it.type, config: it.config ?? undefined, createdAt: it.createdAt ?? undefined }));
}

export async function hasCompanyIntegration(slug: string, type: string): Promise<boolean> {
  if (!slug || !type) return false;
  const list = await getCompanyIntegrationsBySlug(slug);
  return list.some((it) => String(it.type ?? "").toUpperCase() === String(type).toUpperCase());
}

export async function getCompanyIntegrationConfig(slug: string, type: string): Promise<Record<string, unknown> | null> {
  if (!slug || !type) return null;
  const list = await getCompanyIntegrationsBySlug(slug);
  const found = list.find((it) => String(it.type ?? "").toUpperCase() === String(type).toUpperCase());
  return found?.config ?? null;
}

export async function getQaseIntegrationSettings(slug: string) {
  const cfg = await getCompanyIntegrationConfig(slug, "QASE");
  if (!cfg) return null;
  const token = typeof cfg.token === "string" ? cfg.token.trim() : null;
  const projects = Array.isArray(cfg.projects) ? cfg.projects.map(String) : [];
  return { token: token ?? null, projects: projects.length ? projects : undefined };
}
