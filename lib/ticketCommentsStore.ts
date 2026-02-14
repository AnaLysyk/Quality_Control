import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { getJsonStoreDir } from "@/data/jsonStorePath";

/**
 * Registro de comentário de ticket.
 */
export type TicketCommentRecord = {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type CommentsStore = {
  items: TicketCommentRecord[];
};

const STORE_PATH = path.join(getJsonStoreDir(), "ticket-comments.json");
const STORE_KEY = "qc:ticket_comments:v1";
const USE_REDIS = process.env.TICKET_COMMENTS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY = process.env.TICKET_COMMENTS_IN_MEMORY === "true";
let memoryStore: CommentsStore = { items: [] };
let warnedFsFailure = false;

async function ensureStore(): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
    return true;
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
      return true;
    } catch {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        console.warn("[TICKET_COMMENTS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      return false;
    }
  }
}

async function readStore(): Promise<CommentsStore> {
  if (USE_REDIS) {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return { items: [] };
    try {
      const parsed = JSON.parse(raw) as CommentsStore;
      return Array.isArray(parsed?.items) ? parsed : { items: [] };
    } catch {
      return { items: [] };
    }
  }
  if (USE_MEMORY) {
    return memoryStore;
  }
  const ok = await ensureStore();
  if (!ok) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CommentsStore;
    return Array.isArray(parsed?.items) ? parsed : { items: [] };
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: CommentsStore) {
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.set(STORE_KEY, JSON.stringify(next));
    return;
  }
  if (USE_MEMORY) {
    memoryStore = next;
    return;
  }
  const ok = await ensureStore();
  if (!ok) {
    memoryStore = next;
    return;
  }
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
  } catch {
    memoryStore = next;
  }
}

function sanitizeBody(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * Lista comentários de um ticket, ordenados do mais recente para o mais antigo.
 * @param ticketId ID do ticket
 * @param opts Limite e offset opcionais
 * @returns Lista de comentários
 */
export async function listTicketComments(ticketId: string, opts?: { limit?: number; offset?: number }) {
  const store = await readStore();
  const limit = Math.max(1, Math.min(200, Number(opts?.limit ?? 100)));
  const offset = Math.max(0, Number(opts?.offset ?? 0));
  const items = store.items
    .filter((item) => item.ticketId === ticketId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items.slice(offset, offset + limit);
}

/**
 * Cria um novo comentário para um ticket.
 * @param input Dados do comentário
 * @returns Comentário criado ou null
 */
export async function createTicketComment(input: {
  ticketId: string;
  authorUserId: string;
  authorName?: string | null;
  body?: unknown;
}) {
  const body = sanitizeBody(input.body, 2000);
  if (!body) return null;
  const now = new Date().toISOString();
  const comment: TicketCommentRecord = {
    id: randomUUID(),
    ticketId: input.ticketId,
    authorUserId: input.authorUserId,
    authorName: input.authorName ?? null,
    body,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const store = await readStore();
  store.items.unshift(comment);
  await writeStore(store);
  return comment;
}

/**
 * Atualiza o corpo de um comentário de ticket.
 * @param commentId ID do comentário
 * @param body Novo texto
 * @param actorUserId Usuário que está editando
 * @param opts Opções (permitir editar deletado)
 * @returns Comentário atualizado ou null
 */
export async function updateTicketComment(
  commentId: string,
  body: unknown,
  actorUserId: string,
  opts?: { allowWhenDeleted?: boolean },
) {
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === commentId);
  if (idx === -1) return null;
  const current = store.items[idx];
  if (current.deletedAt && !opts?.allowWhenDeleted) return null;
  const nextBody = sanitizeBody(body, 2000);
  if (!nextBody) return null;
  const updated: TicketCommentRecord = {
    ...current,
    body: nextBody,
    updatedAt: new Date().toISOString(),
  };
  store.items[idx] = updated;
  await writeStore(store);
  return updated;
}

/**
 * Marca um comentário como deletado (soft delete).
 * @param commentId ID do comentário
 * @param _actorUserId Usuário que está deletando (não usado)
 * @returns Comentário atualizado ou null
 */
export async function softDeleteTicketComment(commentId: string, _actorUserId: string) {
  const store = await readStore();
  void _actorUserId;
  const idx = store.items.findIndex((item) => item.id === commentId);
  if (idx === -1) return null;
  const current = store.items[idx];
  if (current.deletedAt) return current;
  const updated: TicketCommentRecord = {
    ...current,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.items[idx] = updated;
  await writeStore(store);
  return updated;
}

/**
 * Busca um comentário pelo ID.
 * @param commentId ID do comentário
 * @returns Comentário encontrado ou null
 */
export async function findTicketCommentById(commentId: string) {
  const store = await readStore();
  const item = store.items.find((comment) => comment.id === commentId);
  return item ? { ...item } : null;
}

/**
 * Busca o comentário mais recente de um usuário em um ticket.
 * @param ticketId ID do ticket
 * @param userId ID do usuário
 * @returns Comentário mais recente ou null
 */
export async function getLastCommentByUser(ticketId: string, userId: string) {
  const store = await readStore();
  let latest: TicketCommentRecord | null = null;
  let latestTime = -Infinity;
  for (const comment of store.items) {
    if (comment.ticketId !== ticketId) continue;
    if (comment.authorUserId !== userId) continue;
    if (comment.deletedAt) continue;
    const created = Date.parse(comment.createdAt ?? "");
    if (!Number.isFinite(created)) continue;
    if (created > latestTime) {
      latest = comment;
      latestTime = created;
    }
  }
  return latest ? { ...latest } : null;
}
