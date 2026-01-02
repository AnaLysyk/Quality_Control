import { NextResponse } from "next/server";
import { authenticateRequest, authorizeClientAccess, requireUserRecord, getClientIdFromHeader } from "@/lib/jwtAuth";
import { getClientById } from "@/data/clientsRepository";
import { addUserToClient, getUserRoleInClient } from "@/data/userClientsRepository";
import { getUserByEmail } from "@/data/usersRepository";
import { sql } from "@vercel/postgres";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request);
  const user = await requireUserRecord(auth);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const clientId = params.id || getClientIdFromHeader(request);
  const client = await getClientById(clientId || "");
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  try {
    await authorizeClientAccess({ user: auth!, clientId, requiredRole: "USER" });
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { rows } = await sql`
    select uc.id, uc.user_id, uc.role, uc.active, u.name, u.email
    from user_clients uc
    join users u on u.id = uc.user_id
    where uc.client_id = ${clientId} and uc.active = true
  `;

  return NextResponse.json({ items: rows });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request);
  const user = await requireUserRecord(auth);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const clientId = params.id || getClientIdFromHeader(request);
  const client = await getClientById(clientId || "");
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  try {
    await authorizeClientAccess({ user: auth!, clientId, requiredRole: "ADMIN" });
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = body?.email as string | undefined;
  const role = body?.role as "ADMIN" | "USER" | undefined;
  if (!email || !role) return NextResponse.json({ message: "email e role são obrigatórios" }, { status: 400 });

  const target = await getUserByEmail(email.toLowerCase());
  if (!target) return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });

  const existing = await getUserRoleInClient(target.id, clientId!);
  if (existing && existing.active) {
    return NextResponse.json({ message: "Usuário já vinculado a este cliente" }, { status: 409 });
  }

  const linked = await addUserToClient({ userId: target.id, clientId: clientId!, role });
  return NextResponse.json(linked, { status: 201 });
}
