import "server-only";

import { randomUUID } from "crypto";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

type AssistantAuditEntry = {
  id: string;
  createdAt: string;
  actorUserId: string;
  actorEmail: string | null;
  route: string;
  module: string;
  actionType: "message" | "tool";
  prompt: string | null;
  toolName: string | null;
  success: boolean;
  summary: string | null;
};

type AssistantAuditStore = {
  items: AssistantAuditEntry[];
};

const STORE_KEY = "qc:assistant_audit_log:v1";
const USE_MEMORY = process.env.ASSISTANT_AUDIT_IN_MEMORY === "true";
const USE_PERSISTENT_STORE = !USE_MEMORY && canUsePersistentJsonStore();

let memoryStore: AssistantAuditStore = { items: [] };

async function readStore(): Promise<AssistantAuditStore> {
  if (USE_MEMORY) return memoryStore;

  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.assistantAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    return { items: rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), actorUserId: r.actorUserId, actorEmail: r.actorEmail, route: r.route, module: r.module, actionType: r.actionType as AssistantAuditEntry["actionType"], prompt: r.prompt, toolName: r.toolName, success: r.success, summary: r.summary })) };
  }

  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<AssistantAuditStore>(STORE_KEY, { items: [] });
    return Array.isArray(persisted?.items) ? persisted : { items: [] };
  }
  return memoryStore;
}

async function writeStore(next: AssistantAuditStore) {
  if (USE_MEMORY) {
    memoryStore = next;
    return;
  }

  if (USE_PERSISTENT_STORE) {
    const ok = await writePersistentJson(STORE_KEY, next);
    if (!ok) memoryStore = next;
    return;
  }
  memoryStore = next;
}

export async function appendAssistantAuditEntry(input: Omit<AssistantAuditEntry, "id" | "createdAt">) {
  if (USE_POSTGRES && !USE_MEMORY) {
    const prisma = await getPrisma();
    await prisma.assistantAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        route: input.route,
        module: input.module,
        actionType: input.actionType,
        prompt: input.prompt,
        toolName: input.toolName,
        success: input.success,
        summary: input.summary,
      },
    });
    return;
  }
  const store = await readStore();
  store.items.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  });
  store.items = store.items.slice(0, 500);
  await writeStore(store);
}
