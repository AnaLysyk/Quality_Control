import "server-only";
import { sql } from "@vercel/postgres";

export type Client = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listClients(): Promise<Client[]> {
  const { rows } = await sql<Client>`select * from clients order by created_at desc`;
  return rows;
}

export async function getClientById(id: string): Promise<Client | null> {
  const { rows } = await sql<Client>`select * from clients where id = ${id} limit 1`;
  return rows[0] ?? null;
}

export async function createClient(data: { name: string; slug: string; logo_url?: string | null; description?: string | null }): Promise<Client> {
  const { rows } = await sql<Client>`
    insert into clients (name, slug, logo_url, description, active, created_at, updated_at)
    values (${data.name}, ${data.slug}, ${data.logo_url ?? null}, ${data.description ?? null}, true, now(), now())
    returning *
  `;
  return rows[0];
}

export async function updateClient(id: string, data: Partial<Pick<Client, "name" | "slug" | "logo_url" | "description" | "active">>): Promise<Client | null> {
  const fields = {
    name: data.name ?? null,
    slug: data.slug ?? null,
    logo_url: data.logo_url ?? null,
    description: data.description ?? null,
    active: data.active ?? null,
  };
  const { rows } = await sql<Client>`
    update clients set
      name = coalesce(${fields.name}, name),
      slug = coalesce(${fields.slug}, slug),
      logo_url = coalesce(${fields.logo_url}, logo_url),
      description = coalesce(${fields.description}, description),
      active = coalesce(${fields.active}, active),
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return rows[0] ?? null;
}
