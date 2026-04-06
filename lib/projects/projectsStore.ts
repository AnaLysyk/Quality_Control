import "server-only";

import fs from "fs/promises";
import path from "path";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

export type ProjectRecord = {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  companyId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

const FILE_PATH = path.join(process.cwd(), "data", "support-projects.json");
const STORE_KEY = "qc:support_projects:v1";
const USE_PERSISTENT_STORE = canUsePersistentJsonStore();

async function readFileStore(): Promise<ProjectRecord[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileStore(items: ProjectRecord[]) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

async function readStore(): Promise<ProjectRecord[]> {
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<ProjectRecord[]>(STORE_KEY, []);
    return Array.isArray(persisted) ? persisted : [];
  }
  return readFileStore();
}

async function writeStore(items: ProjectRecord[]) {
  if (USE_PERSISTENT_STORE) {
    const ok = await writePersistentJson(STORE_KEY, items);
    if (ok) return;
  }
  await writeFileStore(items);
}

export const ProjectsStore = {
  async listAll(): Promise<ProjectRecord[]> {
    return readStore();
  },

  async listByCompany(companyId: string): Promise<ProjectRecord[]> {
    const all = await readStore();
    return all.filter((p) => p.companyId === companyId);
  },

  async getById(id: string): Promise<ProjectRecord | null> {
    const all = await readStore();
    return all.find((p) => p.id === id) ?? null;
  },

  async create(record: ProjectRecord): Promise<ProjectRecord> {
    const all = await readStore();
    all.push(record);
    await writeStore(all);
    return record;
  },

  async update(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    const all = await readStore();
    const idx = all.findIndex((p) => p.id === id && (!updates.companyId || p.companyId === updates.companyId));
    if (idx === -1) return null;
    const updated = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await writeStore(all);
    return updated;
  },

  async delete(id: string, companyId?: string | null): Promise<boolean> {
    const all = await readStore();
    const filtered = all.filter((p) => !(p.id === id && (!companyId || p.companyId === companyId)));
    const changed = filtered.length < all.length;
    if (changed) await writeStore(filtered);
    return changed;
  },
};
