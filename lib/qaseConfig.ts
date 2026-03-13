import "server-only";

import { findLocalCompanyBySlug } from "@/lib/auth/localStore";

type QaseSettings = {
  slug: string;
  projectCode?: string;
  projectCodes?: string[];
  token?: string;
  baseUrl?: string;
};

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function readEnv(key: string) {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveScoped(slug: string, key: string) {
  const suffix = normalizeSlug(slug).toUpperCase();
  return readEnv(`${key}_${suffix}`);
}

function normalizeProjectCode(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function normalizeProjectCodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[\s,;|]+/g)
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
  }

  return [];
}

export async function getClientQaseSettings(slug: string): Promise<QaseSettings | null> {
  if (!slug) return null;
  const company = await findLocalCompanyBySlug(slug);

  const companyToken =
    typeof company?.qase_token === "string" && company.qase_token.trim() ? company.qase_token.trim() : null;
  const companyProjectCode = normalizeProjectCode(company?.qase_project_code);
  const companyProjectCodes = [
    ...normalizeProjectCodes(company?.qase_project_codes),
    ...normalizeProjectCodes(company?.qase_project_code),
  ];

  const envProjectCode =
    resolveScoped(slug, "QASE_PROJECT_CODE") ||
    resolveScoped(slug, "QASE_PROJECT") ||
    readEnv("QASE_PROJECT_CODE") ||
    readEnv("QASE_PROJECT") ||
    readEnv("QASE_DEFAULT_PROJECT") ||
    undefined;

  const envProjectCodes = [
    ...normalizeProjectCodes(resolveScoped(slug, "QASE_PROJECT_CODES")),
    ...normalizeProjectCodes(readEnv("QASE_PROJECT_CODES")),
  ];

  const token =
    companyToken ||
    resolveScoped(slug, "QASE_API_TOKEN") ||
    resolveScoped(slug, "QASE_TOKEN") ||
    readEnv("QASE_API_TOKEN") ||
    readEnv("QASE_TOKEN") ||
    undefined;

  const projectCodes = Array.from(new Set([...companyProjectCodes, ...envProjectCodes]));
  const projectCode = companyProjectCode || envProjectCode || projectCodes[0] || undefined;

  const baseUrl = readEnv("QASE_BASE_URL") || "https://api.qase.io";

  return {
    slug,
    token: token ?? undefined,
    projectCode: projectCode ?? undefined,
    projectCodes: projectCodes.length ? projectCodes : undefined,
    baseUrl,
  };
}
