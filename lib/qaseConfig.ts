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

export async function getClientQaseSettings(slug: string): Promise<QaseSettings | null> {
  if (!slug) return null;
  const token =
    resolveScoped(slug, "QASE_API_TOKEN") ||
    resolveScoped(slug, "QASE_TOKEN") ||
    readEnv("QASE_API_TOKEN") ||
    readEnv("QASE_TOKEN") ||
    undefined;

  const projectCode =
    resolveScoped(slug, "QASE_PROJECT_CODE") ||
    resolveScoped(slug, "QASE_PROJECT") ||
    readEnv("QASE_PROJECT_CODE") ||
    readEnv("QASE_PROJECT") ||
    readEnv("QASE_DEFAULT_PROJECT") ||
    undefined;

  const rawProjects = resolveScoped(slug, "QASE_PROJECT_CODES");
  const projectCodes = rawProjects
    ? rawProjects.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

  const baseUrl = readEnv("QASE_BASE_URL") || "https://api.qase.io";

  return {
    slug,
    token: token ?? undefined,
    projectCode: projectCode ?? undefined,
    projectCodes,
    baseUrl,
  };
}
