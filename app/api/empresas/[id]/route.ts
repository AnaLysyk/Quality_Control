import { NextResponse } from "next/server";
import { nowIso, readDb, writeDb } from "@/lib/jsonDb";

export const runtime = "nodejs";

type Empresa = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const FILE = "empresas.json";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const patch = (await req.json().catch(() => null)) as Partial<Empresa> | null;

  const db = await readDb<Empresa>(FILE);
  const idx = db.items.findIndex((e) => e.id === id);

  if (idx < 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (patch?.slug && db.items.some((e) => e.slug === patch.slug && e.id !== id)) {
    return NextResponse.json({ error: "slug já existe" }, { status: 409 });
  }

  const current = db.items[idx];
  const updated: Empresa = {
    ...current,
    name: patch?.name ?? current.name,
    slug: patch?.slug ?? current.slug,
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

  const db = await readDb<Empresa>(FILE);
  const before = db.items.length;
  db.items = db.items.filter((e) => e.id !== id);

  if (db.items.length === before) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  await writeDb(FILE, db);
  return new NextResponse(null, { status: 204 });
}
