import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IS_PROD, SUPABASE_MOCK, SUPABASE_MOCK_RAW } from "@/lib/supabaseMock";

const IS_TEST = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;

// Allow SUPABASE_MOCK only for local/dev/test environments.
const ALLOW_MOCK_FALLBACKS = (SUPABASE_MOCK && !IS_PROD) || IS_TEST;

function sanitizeEnvValue(value: string | undefined) {
  if (!value) return "";
  let raw = value.trim();
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}

function normalizeSupabaseUrl(value: string | undefined) {
  const raw = sanitizeEnvValue(value);
  if (!raw) return undefined;
  let url = raw.replace(/\.supabase\.com\b/i, ".supabase.co");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return url;
}

const supabaseUrl =
  normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
  (ALLOW_MOCK_FALLBACKS ? "http://localhost" : undefined);
const serviceRoleKeyRaw =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_SECRET ||
  (ALLOW_MOCK_FALLBACKS ? "service-role-test" : undefined);
const serviceRoleKey = sanitizeEnvValue(serviceRoleKeyRaw) || (ALLOW_MOCK_FALLBACKS ? "service-role-test" : undefined);

let cachedClient: SupabaseClient | null = null;

// Server-only client (service role). Do not expose in the browser.
export function getSupabaseServer() {
  if (SUPABASE_MOCK_RAW && IS_PROD && !IS_TEST) {
    throw new Error("SUPABASE_MOCK is enabled in production");
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)."
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return cachedClient;
}
