import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prismaClient";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { type Card } from "./types";

const USE_POSTGRES = shouldUsePostgresPersistence();

type KanbanStore = {
  lastId: number;
  items: Card[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kanban.json");
const EMPTY_STORE: KanbanStore = { lastId: 0, items: [] };

async function ensureFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

function normalizeStore(raw: unknown): KanbanStore {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STORE };
  const record = raw as Partial<KanbanStore>;
  const items = Array.isArray(record.items) ? (record.items as Card[]) : [];
  const lastId = Number.isFinite(Number(record.lastId)) ? Number(record.lastId) : 0;
  return { lastId, items };
}

function pgRowToCard(row: {
  id: number;
  project: string;
  clientSlug: string | null;
  runId: number | null;
  caseId: number | null;
  title: string | null;
  status: string | null;
  bug: string | null;
  link: string | null;
  createdAt: Date;
}): Card {
  return {
    id: row.id,
    project: row.project,
    client_slug: row.clientSlug,
    run_id: row.runId ?? undefined,
    case_id: row.caseId,
    title: row.title,
    status: row.status as Card["status"],
    bug: row.bug,
    link: row.link,
    created_at: row.createdAt.toISOString(),
  };
}

export async function readKanbanStore(): Promise<KanbanStore> {
  if (USE_POSTGRES) {
    const rows = await prisma.kanbanCard.findMany({ orderBy: { id: "asc" } });
    const items = rows.map(pgRowToCard);
    const lastId = items.length > 0 ? Math.max(...items.map((i) => i.id)) : 0;
    return { lastId, items };
  }
  try {
    await ensureFile();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STORE };
  }
}

export async function writeKanbanStore(store: KanbanStore): Promise<void> {
  if (USE_POSTGRES) {
    // writeKanbanStore is only called after in-memory mutations in route handlers.
    // We sync by upserting each card individually.
    for (const card of store.items) {
      await prisma.kanbanCard.upsert({
        where: { id: card.id },
        create: {
          id: card.id,
          project: card.project,
          clientSlug: card.client_slug ?? null,
          runId: card.run_id ?? null,
          caseId: card.case_id ?? null,
          title: card.title ?? null,
          status: card.status ?? null,
          bug: card.bug ?? null,
          link: card.link ?? null,
        },
        update: {
          project: card.project,
          clientSlug: card.client_slug ?? null,
          runId: card.run_id ?? null,
          caseId: card.case_id ?? null,
          title: card.title ?? null,
          status: card.status ?? null,
          bug: card.bug ?? null,
          link: card.link ?? null,
        },
      });
    }
    return;
  }
  const payload: KanbanStore = {
    lastId: Number.isFinite(Number(store.lastId)) ? Number(store.lastId) : 0,
    items: Array.isArray(store.items) ? store.items : [],
  };
  await ensureFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export function getNextId(store: KanbanStore): number {
  const maxExisting = store.items.reduce((max, item) => (typeof item.id === "number" && item.id > max ? item.id : max), 0);
  const base = Math.max(store.lastId ?? 0, maxExisting);
  store.lastId = base + 1;
  return store.lastId;
}

/** Cria um card diretamente no banco (Postgres) ou retorna null para fallback JSON. */
export async function createKanbanCard(input: Omit<Card, "id" | "created_at">): Promise<Card | null> {
  if (!USE_POSTGRES) return null;
  const row = await prisma.kanbanCard.create({
    data: {
      project: input.project,
      clientSlug: input.client_slug ?? null,
      runId: input.run_id ?? null,
      caseId: input.case_id ?? null,
      title: input.title ?? null,
      status: input.status ?? null,
      bug: input.bug ?? null,
      link: input.link ?? null,
    },
  });
  return pgRowToCard(row);
}

/** Deleta um card do banco (Postgres) ou retorna false para fallback JSON. */
export async function deleteKanbanCard(id: number): Promise<boolean> {
  if (!USE_POSTGRES) return false;
  const result = await prisma.kanbanCard.deleteMany({ where: { id } });
  return result.count > 0;
}
