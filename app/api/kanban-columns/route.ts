import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { isDevRole } from "@/lib/rbac/devAccess";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

export const revalidate = 0;

type KanbanColumn = {
  key: string;
  label: string;
  locked?: boolean;
};

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { key: "backlog", label: "Backlog", locked: true },
  { key: "doing", label: "Em andamento", locked: true },
  { key: "review", label: "Em revisao", locked: true },
  { key: "done", label: "Concluido", locked: true },
];

const STORE_KEY = "qc:kanban_columns:v1";
const USE_PERSISTENT_STORE = canUsePersistentJsonStore();
let memoryColumns: KanbanColumn[] = DEFAULT_COLUMNS;

async function readColumns(): Promise<KanbanColumn[]> {
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<{ columns?: KanbanColumn[] }>(STORE_KEY, { columns: DEFAULT_COLUMNS });
    return Array.isArray(persisted?.columns) ? persisted.columns : DEFAULT_COLUMNS;
  }
  return memoryColumns;
}

async function writeColumns(columns: KanbanColumn[]): Promise<void> {
  if (USE_PERSISTENT_STORE) {
    const ok = await writePersistentJson(STORE_KEY, { columns });
    if (ok) return;
  }
  memoryColumns = columns;
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const columns = await readColumns();
  return NextResponse.json({ columns }, { status: 200 });
}

export async function PUT(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isDevRole(user.role) && !user.isGlobalAdmin) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body?.columns)) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const columns: KanbanColumn[] = body.columns
    .filter((col: unknown) => col && typeof col === "object")
    .map((col: { key?: unknown; label?: unknown; locked?: unknown }) => ({
      key: String(col.key ?? "").trim(),
      label: String(col.label ?? "").trim(),
      ...(col.locked !== undefined ? { locked: Boolean(col.locked) } : {}),
    }))
    .filter((col: KanbanColumn) => col.key && col.label);

  await writeColumns(columns);
  return NextResponse.json({ columns }, { status: 200 });
}
