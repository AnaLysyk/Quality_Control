import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";

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
  const { data, error } = await supabaseServer.from("users").select("*").order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data as Usuario[]) ?? [];
}

export async function updateUserAvatar(id: string, avatarUrl: string): Promise<Usuario | null> {
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
