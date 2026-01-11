import "server-only";

import { getSupabaseServer } from "@/lib/supabaseServer";

const CLIENT_TABLES = ["cliente", "clients"] as const;
const cache = new Map<string, Promise<ClientQaseSettings | null>>();

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeSlug = (slug?: string) => {
  if (!slug) return null;
  const trimmed = slug.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
};

export type ClientQaseSettings = {
  slug: string;
  token: string | null;
  projectCode: string | null;
};

export async function getClientQaseSettings(slug?: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  const promise = (async () => {
    try {
      const supabase = getSupabaseServer();
      for (const table of CLIENT_TABLES) {
        const { data, error } = await supabase.from(table).select("*").eq("slug", normalized).maybeSingle();
        if (error || !data) continue;

        const row = data as Record<string, unknown>;
        const token =
          normalizeString(row.qase_token ?? row.token ?? row.api_token ?? row.qaseToken ?? null) ?? null;
        const projectCode =
          normalizeString(
            row.qase_project_code ??
              row.qase_project ??
              row.project_code ??
              row.project ??
              row.projectCode ??
              row.projectKey ??
              null
          ) ?? null;

        return { slug: normalized, token, projectCode };
      }
    } catch (error) {
      console.error(`[QASE][CONFIG] Unable to read settings for slug "${normalized}"`, error);
    }

    return null;
  })();

  cache.set(normalized, promise);
  return promise;
}
