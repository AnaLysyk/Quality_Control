import "server-only";
import { getPostgresSql } from "@/lib/vercelPostgres";

export type Usuario = {
  id: string;
  name?: string;
  email: string;
  password_hash?: string;
  avatar_url?: string | null;
  is_global_admin?: boolean;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function getUserById(id: string): Promise<Usuario | null> {
  const sql = getPostgresSql();
  if (!sql) return null;
  const { rows } = await sql<Usuario>`select * from users where id = ${id} limit 1`;
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<Usuario | null> {
  const sql = getPostgresSql();
  if (!sql) return null;
  try {
    const normalized = (email ?? "").trim();
    if (!normalized) return null;
    const { rows } = await sql<Usuario>`
      select * from users
      where lower(trim(email)) = lower(trim(${normalized}))
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listUsers(): Promise<Usuario[]> {
  const sql = getPostgresSql();
  if (!sql) return [];
  const { rows } = await sql<Usuario>`select * from users order by created_at desc`;
  return rows ?? [];
}

export async function updateUserAvatar(id: string, avatarUrl: string): Promise<Usuario | null> {
  const sql = getPostgresSql();
  if (!sql) return null;
  const { rows } = await sql<Usuario>`
    update users set avatar_url = ${avatarUrl}, updated_at = now()
    where id = ${id}
    returning *
  `;
  return rows[0] ?? null;
}
