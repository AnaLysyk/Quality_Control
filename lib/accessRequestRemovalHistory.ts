import "server-only";

import { randomUUID } from "crypto";
import { readPersistentJson, writePersistentJson } from "@/database/persistentJsonStore";

const STORE_KEY = "qc:access_requests:removal_history:v1";
const MAX_HISTORY_ITEMS = 1000;

export type AccessRequestRemovalHistoryItem = {
  id: string;
  requestId: string;
  requesterEmail: string;
  requesterName?: string | null;
  requestStatus?: string | null;
  requestType?: string | null;
  requestedRole?: string | null;
  requestedCompanyId?: string | null;
  requestedCompanySlug?: string | null;
  removedAt: string;
  removedByUserId?: string | null;
  removedByEmail?: string | null;
  source: string;
};

type RemovalHistoryStore = {
  items: AccessRequestRemovalHistoryItem[];
};

export async function appendAccessRequestRemovalHistory(
  input: Omit<AccessRequestRemovalHistoryItem, "id" | "removedAt">,
) {
  const store = await readPersistentJson<RemovalHistoryStore>(STORE_KEY, { items: [] });
  const item: AccessRequestRemovalHistoryItem = {
    ...input,
    id: randomUUID(),
    removedAt: new Date().toISOString(),
  };

  const next: RemovalHistoryStore = {
    items: [item, ...(Array.isArray(store.items) ? store.items : [])].slice(0, MAX_HISTORY_ITEMS),
  };

  await writePersistentJson(STORE_KEY, next);
  return item;
}

export async function listAccessRequestRemovalHistory() {
  const store = await readPersistentJson<RemovalHistoryStore>(STORE_KEY, { items: [] });
  return [...(Array.isArray(store.items) ? store.items : [])].sort((a, b) => b.removedAt.localeCompare(a.removedAt));
}

