import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (process.env.NODE_ENV === "test" ? "http://localhost" : undefined);
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (process.env.NODE_ENV === "test" ? "service-role-test" : undefined);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// Client apenas para uso no servidor (service role). Não exponha no browser.
export const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
