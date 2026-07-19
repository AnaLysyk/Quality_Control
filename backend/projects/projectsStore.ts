import "server-only";

import { shouldUsePostgresPersistence } from "@/database/persistenceMode";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/database/persistentJsonStore";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

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

const STORE_KEY = "qc:support_projects:v1";
const USE_PERSISTENT_STORE = !USE_POSTGRES && canUsePersistentJsonStore();
let memoryItems: ProjectRecord[] = [];

function pgToRecord(r: { id: string; code: string | null; title: string; description: string | null; companyId: string | null; createdBy: string | null; createdAt: Date; updatedAt: Date }): ProjectRecord {
  return { id: r.id, code: r.code, title: r.title, description: r.description, companyId: r.companyId, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

async function readStore(): Promise<ProjectRecord[]> {
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<ProjectRecord[]>(STORE_KEY, []);
    return Array.isArray(persisted) ? persisted : [];
  }
  return memoryItems;
}

async function writeStore(items: ProjectRecord[]) {
  if (USE_PERSISTENT_STORE) {
    const ok = await writePersistentJson(STORE_KEY, items);
    if (ok) return;
  }
  memoryItems = items;
}

export const ProjectsStore = {
  async listAll(): Promise<ProjectRecord[]> {
    if (USE_POSTGRES) {
      const prisma = await getPrisma();
      const rows = await prisma.supportProject.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map(pgToRecord);
    }
    return readStore();
  },

  async listByCompany(companyId: string): Promise<ProjectRecord[]> {
    if (USE_POSTGRES) {
      const prisma = await getPrisma();
      const rows = await prisma.supportProject.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
      return rows.map(pgToRecord);
    }
    const all = await readStore();
    return all.filter((p) => p.companyId === companyId);
  },

  async getById(id: string): Promise<ProjectRecord | null> {
    if (USE_POSTGRES) {
      const prisma = await getPrisma();
      const row = await prisma.supportProject.findUnique({ where: { id } });
      return row ? pgToRecord(row) : null;
    }
    const all = await readStore();
    return all.find((p) => p.id === id) ?? null;
  },

  async create(record: ProjectRecord): Promise<ProjectRecord> {
    if (USE_POSTGRES) {
      const prisma = await getPrisma();
      const row = await prisma.supportProject.create({
        data: { id: record.id, code: record.code ?? null, title: record.title, description: record.description ?? null, companyId: record.companyId ?? null, createdBy: record.createdBy ?? null },
      });
      return pgToRecord(row);
    }
    const all = await readStore();
    all.push(record);
    await writeStore(all);
    return record;
  },

  async update(id: string, companyId: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    if (USE_POSTGRES) {
      const prisma = await getPrisma();
      const existing = await prisma.supportProject.findFirst({ where: { id, companyId } });
      if (!existing) return null;
      const row = await prisma.supportProject.update({
        where: { id },
        data: {
          ...(updates.title !== undefined ? { title: updates.title } : {}),
          ...(updates.code !== undefined ? { code: updates.code } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
        },
      });
      return pgToRecord(row);
    }
    const all = await readStore();
    const idx = all.findIndex((p) => p.id === id && p.companyId === companyId);
    if (idx === -1) return null;
    const updated = { ...all[idx], ...updates, companyId, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await writeStore(all);
    return updated;
  },

  async delete(id: string, companyId?: string | null): Promise<boolean> {
    if (USE_POSTGRES) {
      const prisma = await getPrisma();
      const result = await prisma.supportProject.deleteMany({ where: { id, ...(companyId ? { companyId } : {}) } });
      return result.count > 0;
    }
    const all = await readStore();
    const filtered = all.filter((p) => !(p.id === id && (!companyId || p.companyId === companyId)));
    const changed = filtered.length < all.length;
    if (changed) await writeStore(filtered);
    return changed;
  },
};

