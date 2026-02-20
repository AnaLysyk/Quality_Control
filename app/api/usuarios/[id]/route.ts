export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const db = await readDb<Usuario>(FILE);
  const item = db.items.find((u) => u.id === id) ?? null;

  if (!item) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  return NextResponse.json(item);
}
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";
import { nowIso, readDb, writeDb } from "@/lib/jsonDb";

export const runtime = "nodejs";

type UsuarioRole = "admin" | "company_admin" | "user" | "dev";

type Usuario = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  role: UsuarioRole;
  companyId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const FILE = "usuarios.json";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const patch = (await req.json().catch(() => null)) as Partial<Usuario> | null;

  const db = await readDb<Usuario>(FILE);
  const idx = db.items.findIndex((u) => u.id === id);

  if (idx < 0) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  // unicidade email/cpf
  if (patch?.email && db.items.some((u) => u.email === patch.email && u.id !== id)) {
    return NextResponse.json({ error: "email já existe" }, { status: 409 });
  }

  if (patch?.cpf && db.items.some((u) => u.cpf === patch.cpf && u.id !== id)) {
    return NextResponse.json({ error: "cpf já existe" }, { status: 409 });
  }

  const current = db.items[idx];

  const updated: Usuario = {
    ...current,
    name: patch?.name ?? current.name,
    email: patch?.email ?? current.email,
    cpf: patch?.cpf ?? current.cpf,
    role: (patch?.role ?? current.role) as UsuarioRole,
    companyId: patch?.companyId ?? current.companyId,
    isActive: patch?.isActive ?? current.isActive,
    updatedAt: nowIso(),
  };

  db.items[idx] = updated;
  await writeDb(FILE, db);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const db = await readDb<Usuario>(FILE);
  const before = db.items.length;

  db.items = db.items.filter((u) => u.id !== id);

  if (db.items.length === before) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  await writeDb(FILE, db);
  return new NextResponse(null, { status: 204 });
}
