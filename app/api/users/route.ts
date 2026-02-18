
import { NextResponse } from "next/server";
import { readUsers, writeUsers, logEvent, updateUser, softDeleteUser } from "./repository";
// PATCH → atualizar usuário
export async function PATCH(req: Request) {
  const body = await req.json();
  const { companyId, userId, updates, metadata } = body;
  if (!companyId || !userId || !updates) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  const updated = await updateUser(companyId, userId, updates, metadata || {});
  if (!updated) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE → soft delete usuário
export async function DELETE(req: Request) {
  const body = await req.json();
  const { companyId, userId, metadata } = body;
  if (!companyId || !userId) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  const deleted = await softDeleteUser(companyId, userId, metadata || {});
  if (!deleted) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  return NextResponse.json(deleted);
}


// GET → listar usuários de uma empresa
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url!);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
  const users = await readUsers(companyId);
  return NextResponse.json(users);
}

// POST → criar usuário multi-empresa
export async function POST(req: Request) {
  const body = await req.json();
  const { companyId, name, email } = body;
  if (!companyId || !name || !email) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  const users = await readUsers(companyId);

  const newUser = {
    id: crypto.randomUUID(),
    name,
    email,
    companyId,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(companyId, users);
  await logEvent(companyId, { type: "USER_CREATED", user: newUser });

  return NextResponse.json(newUser, { status: 201 });
}
