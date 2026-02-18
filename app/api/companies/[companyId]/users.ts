import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getUsersPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "users.json");
}

async function readUsers(companyId: string) {
  try {
    const data = await fs.readFile(getUsersPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeUsers(companyId: string, users: any[]) {
  await fs.mkdir(path.dirname(getUsersPath(companyId)), { recursive: true });
  await fs.writeFile(getUsersPath(companyId), JSON.stringify(users, null, 2));
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const users = await readUsers(companyId);
  return NextResponse.json(users);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.name || !body.email || !body.role) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const users = await readUsers(companyId);
  const newUser = {
    id: crypto.randomUUID(),
    name: body.name,
    email: body.email,
    role: body.role,
    companyId,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  await writeUsers(companyId, users);
  return NextResponse.json(newUser, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const users = await readUsers(companyId);
  const idx = users.findIndex((u: any) => u.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  Object.assign(users[idx], body.updates, { updatedAt: new Date().toISOString() });
  await writeUsers(companyId, users);
  return NextResponse.json(users[idx]);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const users = await readUsers(companyId);
  const idx = users.findIndex((u: any) => u.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  users[idx].deletedAt = new Date().toISOString();
  await writeUsers(companyId, users);
  return NextResponse.json({ ok: true });
}
