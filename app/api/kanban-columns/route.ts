import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "kanbanColumns.json");
const DEFAULT_COLUMNS = [
  { key: "backlog", label: "Backlog", locked: true },
  { key: "doing", label: "Em andamento", locked: true },
  { key: "review", label: "Em revisao", locked: true },
  { key: "done", label: "Concluido", locked: true },
];

async function readColumns() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

async function writeColumns(columns: any[]) {
  await fs.writeFile(DATA_PATH, JSON.stringify(columns, null, 2), "utf-8");
}

export async function GET() {
  const columns = await readColumns();
  return NextResponse.json({ columns });
}

export async function PUT(request: Request) {
  try {
    const { columns } = await request.json();
    if (!Array.isArray(columns)) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }
    await writeColumns(columns);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
