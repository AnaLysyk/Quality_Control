import { NextRequest, NextResponse } from "next/server";
import { makeId, nowIso, readDb, writeDb } from "@/lib/jsonDb";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb<Usuario>(FILE);
  return NextResponse.json({ items: db.items });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<Usuario> | null;

  if (!body?.name || !body?.email || !body?.cpf) {
    return NextResponse.json(
      { error: "Campos obrigatórios: name, email, cpf" },
      { status: 400 },
    );
  }

  const db = await readDb<Usuario>(FILE);

  const existsEmail = db.items.some((u) => u.email === body.email);
  if (existsEmail) return NextResponse.json({ error: "email já existe" }, { status: 409 });

  const existsCpf = db.items.some((u) => u.cpf === body.cpf);
  if (existsCpf) return NextResponse.json({ error: "cpf já existe" }, { status: 409 });

  const createdAt = nowIso();

  const usuario: Usuario = {
    id: makeId("usr"),
    name: String(body.name),
    email: String(body.email),
    cpf: String(body.cpf),
    role: (body.role ?? "user") as UsuarioRole,
    companyId: body.companyId ?? null,
    isActive: body.isActive ?? true,
    createdAt,
    updatedAt: createdAt,
  };

  db.items.unshift(usuario);
  await writeDb(FILE, db);

  return NextResponse.json(usuario, { status: 201 });
}
