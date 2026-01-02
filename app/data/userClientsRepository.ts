import "server-only";
import { sql } from "@vercel/postgres";

export type UserClient = {
  id: string;
  user_id: string;
  client_id: string;
  role: "ADMIN" | "USER";
  active: boolean;
  created_at: string;
};

export async function getUserRoleInClient(userId: string, clientId: string): Promise<UserClient | null> {
  const { rows } = await sql<UserClient>`
    select * from user_clients
    where user_id = ${userId} and client_id = ${clientId} and active = true
    limit 1
  `;
  return rows[0] ?? null;
}

export async function listUsersByClient(clientId: string): Promise<UserClient[]> {
  const { rows } = await sql<UserClient>`
    select * from user_clients where client_id = ${clientId} and active = true
  `;
  return rows;
}

export async function addUserToClient(data: { userId: string; clientId: string; role: "ADMIN" | "USER" }): Promise<UserClient> {
  const { rows } = await sql<UserClient>`
    insert into user_clients (user_id, client_id, role, active, created_at)
    values (${data.userId}, ${data.clientId}, ${data.role}, true, now())
    returning *
  `;
  return rows[0];
}
