import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  let url = raw.replace(/\.supabase\.com\b/i, ".supabase.co");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return url;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ex.: em .env.local) e reinicie o dev server."
    );
  }

  cachedClient = createClient(supabaseUrl, anonKey);
  return cachedClient;
}
