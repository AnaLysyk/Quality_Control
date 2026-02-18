import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url!);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
  const base = path.join(process.cwd(), "data", "companies", companyId);
  try {
    const files = await fs.readdir(base);
    const backup: Record<string, any> = {};
    for (const file of files) {
      if (file.endsWith('.json')) {
        backup[file] = JSON.parse(await fs.readFile(path.join(base, file), "utf8"));
      }
    }
    return NextResponse.json(backup);
  } catch {
    return NextResponse.json({ error: "Empresa não encontrada ou erro ao ler arquivos" }, { status: 404 });
  }
}
