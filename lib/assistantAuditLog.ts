import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

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

const STORE_PATH = path.join(process.cwd(), "data", "assistant-audit-log.json");
const USE_MEMORY = process.env.ASSISTANT_AUDIT_IN_MEMORY === "true" || process.env.VERCEL === "1";
let memoryStore: AssistantAuditStore = { items: [] };

async function ensureStore() {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
    return true;
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
      return true;
    } catch {
      return false;
    }
  }
}

async function readStore(): Promise<AssistantAuditStore> {
  if (USE_MEMORY) return memoryStore;
  const ok = await ensureStore();
  if (!ok) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AssistantAuditStore;
    return Array.isArray(parsed?.items) ? parsed : { items: [] };
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: AssistantAuditStore) {
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

export async function appendAssistantAuditEntry(input: Omit<AssistantAuditEntry, "id" | "createdAt">) {
  const store = await readStore();
  store.items.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  });
  store.items = store.items.slice(0, 500);
  await writeStore(store);
}
