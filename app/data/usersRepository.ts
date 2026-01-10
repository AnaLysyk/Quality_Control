import "server-only";
import { supabaseServer as _supabaseServer, getSupabaseServer } from "@/lib/supabaseServer";

// Prefer @vercel/postgres 'sql' when available (tests mock it). Fallback to
// Supabase client when `sql` is not present or Supabase is configured.
let sql: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pg = require("@vercel/postgres");
  sql = pg.sql ?? pg;
} catch {
  sql = null;
}

export type Usuario = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  is_global_admin: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getUserById(id: string): Promise<Usuario | null> {
  if (sql) {
    const res = await sql`select * from users where id = ${id} limit 1`;
    const row = (res?.rows && res.rows[0]) ?? null;
    return (row as Usuario | null) ?? null;
  }

  const supabaseServer = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  const { data, error } = await supabaseServer
    .from("users")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data as Usuario | null) ?? null;
}

export async function getUserByEmail(email: string): Promise<Usuario | null> {
  if (sql) {
    const res = await sql`select * from users where email = ${email} limit 1`;
    const row = (res?.rows && res.rows[0]) ?? null;
    return (row as Usuario | null) ?? null;
  }

  const supabaseServer = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  const { data, error } = await supabaseServer
    .from("users")
    .select("*")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data as Usuario | null) ?? null;
}

export async function listUsers(): Promise<Usuario[]> {
  if (sql) {
    const res = await sql`select * from users order by created_at desc`;
    return (res?.rows as Usuario[]) ?? [];
  }

  const supabaseServer = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  const { data, error } = await supabaseServer.from("users").select("*").order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data as Usuario[]) ?? [];
}

export async function updateUserAvatar(id: string, avatarUrl: string): Promise<Usuario | null> {
  if (sql) {
    const res = await sql(
      "update users set avatar_url = $1, updated_at = now() where id = $2 returning *",
      avatarUrl,
      id,
    );
    return (res?.rows && res.rows[0]) ?? null;
  }

  const supabaseServer = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  const { data, error } = await supabaseServer
    .from("users")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data as Usuario | null) ?? null;
}
