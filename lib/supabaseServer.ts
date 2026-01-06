import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  (SUPABASE_MOCK || process.env.NODE_ENV === "test" ? "http://localhost" : undefined);
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (SUPABASE_MOCK || process.env.NODE_ENV === "test" ? "service-role-test" : undefined);

let cachedClient: SupabaseClient | null = null;

// Server-only client (service role). Do not expose in the browser.
export function getSupabaseServer() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return cachedClient;
}
