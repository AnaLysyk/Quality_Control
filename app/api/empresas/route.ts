import { NextResponse } from "next/server";
import { makeId, nowIso, readDb, writeDb } from "@/lib/jsonDb";

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

export async function GET() {
  const db = await readDb<Empresa>(FILE);
  return NextResponse.json({ items: db.items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<Empresa> | null;

  if (!body?.name || !body?.slug) {
    return NextResponse.json(
      { error: "Campos obrigatórios: name, slug" },
      { status: 400 },
    );
  }

  const db = await readDb<Empresa>(FILE);

  const existsSlug = db.items.some((e) => e.slug === body.slug);
  if (existsSlug) {
    return NextResponse.json({ error: "slug já existe" }, { status: 409 });
  }

  const createdAt = nowIso();

  const empresa: Empresa = {
    id: makeId("emp"),
    name: String(body.name),
    slug: String(body.slug),
    isActive: body.isActive ?? true,
    createdAt,
    updatedAt: createdAt,
  };

  db.items.unshift(empresa);
  await writeDb(FILE, db);

  return NextResponse.json(empresa, { status: 201 });
}
