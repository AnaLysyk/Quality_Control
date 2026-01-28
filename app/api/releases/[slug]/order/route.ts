import { NextResponse } from "next/server";
// Importa fs e path só em ambiente Node/server
let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}

const filePath = path && path.join(process.cwd(), "data", "releases-store.json");

type ReleaseRecord = {
  slug: string;
  order?: unknown;
  [key: string]: unknown;
};

function isReleaseRecord(value: unknown): value is ReleaseRecord {
  return typeof value === "object" && value !== null && typeof (value as { slug?: unknown }).slug === "string";
}

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  try {
    const body = (await req.json()) as { order?: unknown };
    const order = Array.isArray(body.order) ? body.order : null;
    if (!order) {
      return NextResponse.json({ error: "Campo 'order' inválido" }, { status: 400 });
    }

    if (!fs || !filePath) {
      return NextResponse.json({ error: "Ambiente não suporta fs/path" }, { status: 500 });
    }
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 500 });
    }

    const idx = parsed.findIndex((item) => isReleaseRecord(item) && item.slug === slug);
    if (idx === -1) {
      return NextResponse.json({ error: "Release não encontrada" }, { status: 404 });
    }

    const updated = [...parsed];
    (updated[idx] as ReleaseRecord).order = order;

    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao salvar ordem" }, { status: 500 });
  }
}
