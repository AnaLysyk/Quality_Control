import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: SupabaseClient | null = null;

export async function createClient() {
  if (cachedClient) return cachedClient;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase URL or anon key (NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  }
  cachedClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cachedClient;
}
