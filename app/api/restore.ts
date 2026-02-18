import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const body = await req.json();
  const { companyId, files } = body;
  if (!companyId || !files || typeof files !== 'object') {
    return NextResponse.json({ error: "companyId e arquivos obrigatórios" }, { status: 400 });
  }
  const base = path.join(process.cwd(), "data", "companies", companyId);
  try {
    await fs.mkdir(base, { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      await fs.writeFile(path.join(base, file), JSON.stringify(content, null, 2));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao restaurar arquivos" }, { status: 500 });
  }
}
