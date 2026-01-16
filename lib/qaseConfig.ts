import "server-only";

import { getSupabaseServer } from "@/lib/supabaseServer";

const CLIENT_TABLES = ["cliente", "clients"] as const;
const cache = new Map<string, Promise<ClientQaseSettings | null>>();

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeSlug = (slug?: string | null) => {
  if (!slug) return null;
  const trimmed = slug.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
};

type EnvProjectEntry = {
  slug: string;
  projectCode: string;
};

const normalizeEnvString = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
};

const normalizeSlugValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  return normalizeSlug(value);
};

const normalizeProjectCode = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
};

function parseProjectMapFromEnv(): EnvProjectEntry[] {
  const raw = normalizeEnvString(
    process.env.QASE_PROJECT_MAP || process.env.QASE_PROJECTS || process.env.NEXT_PUBLIC_QASE_PROJECT_MAP || "",
  ).trim();
  if (!raw) return [];

  const entries: EnvProjectEntry[] = [];
  const addEntry = (slugValue: unknown, codeValue: unknown) => {
    const slug = normalizeSlugValue(slugValue);
    const code = normalizeProjectCode(codeValue);
    if (slug && code) {
      entries.push({ slug, projectCode: code });
    }
  };

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (!item || typeof item !== "object") return;
          const rec = item as Record<string, unknown>;
          addEntry(rec.slug ?? rec.name ?? rec.company ?? null, rec.projectCode ?? rec.project ?? rec.code ?? null);
        });
        if (entries.length) return entries;
      }
    } catch {
      // ignore parse errors
    }
  }

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        Object.entries(parsed as Record<string, unknown>).forEach(([slugKey, value]) => {
          addEntry(slugKey, value);
        });
        if (entries.length) return entries;
      }
    } catch {
      // ignore parse errors
    }
  }

  const parts = raw.split(/[,;\|]+/g).map((part) => part.trim()).filter(Boolean);
  parts.forEach((part) => {
    const [slugRaw, codeRaw] = part.split(/[:=]/).map((value) => value.trim());
    addEntry(slugRaw, codeRaw);
  });

  return entries;
}

const envProjectMap = parseProjectMapFromEnv();

function getEnvProjectCodesForSlug(slug?: string | null) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return [];
  return Array.from(
    new Set(envProjectMap.filter((entry) => entry.slug === normalized).map((entry) => entry.projectCode)),
  );
}

export type ClientQaseSettings = {
  slug: string;
  token: string | null;
  projectCode: string | null;
  projectCodes: string[];
};

function parseProjectCodes(value: unknown): string[] {
  const normalize = (code: string) => code.trim().toUpperCase();

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map(normalize)
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\s,;|]+/g)
      .map(normalize)
      .filter(Boolean);
  }

  return [];
}

export async function getClientQaseSettings(slug?: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  const envProjectCodes = getEnvProjectCodesForSlug(normalized);

  const promise = (async () => {
    try {
      const supabase = getSupabaseServer();
      for (const table of CLIENT_TABLES) {
        const { data, error } = await supabase.from(table).select("*").eq("slug", normalized).maybeSingle();
        if (error || !data) continue;

        const row = data as Record<string, unknown>;
        const token =
          normalizeString(row.qase_token ?? row.token ?? row.api_token ?? row.qaseToken ?? null) ?? null;
        const singleProject =
          normalizeString(
            row.qase_project_code ??
              row.qase_project ??
              row.project_code ??
              row.project ??
              row.projectCode ??
              row.projectKey ??
              null
          ) ?? null;
        const multiProjects = parseProjectCodes(row.qase_project_codes ?? row.project_codes ?? row.projects ?? null);

        const combined = Array.from(
          new Set([
            ...(singleProject ? [singleProject.toUpperCase()] : []),
            ...multiProjects,
            ...envProjectCodes,
          ]),
        );

        return {
          slug: normalized,
          token,
          projectCode: combined[0] ?? null,
          projectCodes: combined,
        };
      }
    } catch (error) {
      console.error(`[QASE][CONFIG] Unable to read settings for slug "${normalized}"`, error);
    }

    if (envProjectCodes.length) {
      return {
        slug: normalized,
        token: null,
        projectCode: envProjectCodes[0] ?? null,
        projectCodes: envProjectCodes,
      };
    }

    return null;
  })();

  cache.set(normalized, promise);
  return promise;
}
