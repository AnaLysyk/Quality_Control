import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

function normalizeSupabaseUrl(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  let url = raw.replace(/\.supabase\.com\b/i, ".supabase.co");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return url;
}

const SUPABASE_URL =
  normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
  (SUPABASE_MOCK || process.env.NODE_ENV === "test" ? "http://localhost" : undefined);
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (SUPABASE_MOCK || process.env.NODE_ENV === "test" ? "service-role-test" : undefined);

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }

  return cachedClient;
}
