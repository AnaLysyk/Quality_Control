import fs from "fs";
import path from "path";

import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

const DATA_PATH = path.join(process.cwd(), "data", "company-applications.json");

export type AppRecord = {
  id: string;
  companyId?: string;
  companySlug?: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  qaseProjectCode?: string | null;
  source?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApplicationsDb = {
  items: AppRecord[];
  counter: number;
};

type ApplicationSeed = Partial<AppRecord> & {
  name: string;
};

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeProjectCode(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function readFile(): ApplicationsDb {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ApplicationsDb> | null;
    return {
      items: Array.isArray(parsed?.items) ? (parsed?.items as AppRecord[]) : [],
      counter: typeof parsed?.counter === "number" ? parsed.counter : 0,
    };
  } catch {
    return { items: [], counter: 0 };
  }
}

function writeFile(data: ApplicationsDb) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function pgToRecord(r: { id: string; companyId?: string | null; companySlug?: string | null; name: string; slug: string; description?: string | null; imageUrl?: string | null; qaseProjectCode?: string | null; source?: string | null; active: boolean; createdAt: Date; updatedAt: Date }): AppRecord {
  return { id: r.id, companyId: r.companyId ?? undefined, companySlug: r.companySlug ?? undefined, name: r.name, slug: r.slug, description: r.description ?? null, imageUrl: r.imageUrl ?? null, qaseProjectCode: r.qaseProjectCode ?? null, source: r.source ?? null, active: r.active, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

export async function listApplications(filter?: { companySlug?: string }): Promise<AppRecord[]> {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.application.findMany({ where: filter?.companySlug ? { companySlug: filter.companySlug } : undefined });
    return rows.map(pgToRecord);
  }
  const db = readFile();
  let items: AppRecord[] = db.items || [];
  if (filter?.companySlug) {
    items = items.filter((i) => i.companySlug === filter.companySlug);
  }
  return items;
}

export async function createApplication(input: ApplicationSeed): Promise<AppRecord> {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
    const qaseProjectCode = normalizeProjectCode(input.qaseProjectCode);
    const r = await prisma.application.create({ data: { id, companyId: input.companyId ?? input.companySlug ?? null, companySlug: input.companySlug ?? input.companyId ?? null, name: input.name || "Untitled", slug: normalizeSlug(input.slug || qaseProjectCode || input.name || "untitled"), description: input.description ?? null, qaseProjectCode, source: input.source ?? null, active: typeof input.active === "boolean" ? input.active : true } });
    return pgToRecord(r);
  }
  const db = readFile();
  const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const now = new Date().toISOString();
  const qaseProjectCode = normalizeProjectCode(input.qaseProjectCode);
  const record: AppRecord = {
    id,
    companyId: input.companyId ?? input.companySlug ?? undefined,
    companySlug: input.companySlug ?? input.companyId ?? undefined,
    name: input.name || "Untitled",
    slug: normalizeSlug(input.slug || qaseProjectCode || input.name || "untitled"),
    description: input.description ?? null,
    qaseProjectCode,
    source: input.source ?? null,
    active: typeof input.active === "boolean" ? input.active : true,
    createdAt: now,
    updatedAt: now,
  };

  db.items = db.items || [];
  db.items.unshift(record);
  db.counter = (db.counter || 0) + 1;
  writeFile(db);
  return record;
}

export async function updateApplication(id: string, input: { name?: string; description?: string | null; imageUrl?: string | null; active?: boolean }): Promise<AppRecord | null> {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing) return null;
    const r = await prisma.application.update({ where: { id }, data: { name: input.name ?? existing.name, description: input.description !== undefined ? input.description : existing.description, imageUrl: input.imageUrl !== undefined ? input.imageUrl : (existing as Record<string, unknown>).imageUrl as string | null ?? null, active: input.active ?? existing.active } });
    return pgToRecord(r);
  }
  const db = readFile();
  const idx = db.items.findIndex((item) => item.id === id);
  if (idx < 0) return null;
  const current = db.items[idx];
  const updated: AppRecord = {
    ...current,
    name: input.name ?? current.name,
    description: input.description !== undefined ? input.description : current.description,
    imageUrl: input.imageUrl !== undefined ? input.imageUrl : current.imageUrl,
    active: input.active ?? current.active,
    updatedAt: new Date().toISOString(),
  };
  db.items[idx] = updated;
  writeFile(db);
  return updated;
}

export async function syncCompanyApplications(input: {
  companyId?: string | null;
  companySlug?: string | null;
  projects: Array<{ code: string; title?: string | null }>;
  source?: string | null;
}): Promise<AppRecord[]> {
  const companySlug = input.companySlug?.trim() || input.companyId?.trim() || undefined;
  const companyId = input.companyId?.trim() || input.companySlug?.trim() || undefined;
  if (!companySlug) return [];
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const synced: AppRecord[] = [];
    const now = new Date().toISOString();
    for (const project of input.projects) {
      const code = normalizeProjectCode(project.code);
      if (!code) continue;
      const slug = normalizeSlug(code);
      const name = (project.title ?? code).trim() || code;
      const src = input.source ?? "qase";
      const r = await prisma.application.upsert({ where: { slug_companySlug: { slug, companySlug } }, create: { id: `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`, companyId: companyId ?? null, companySlug, name, slug, qaseProjectCode: code, source: src, active: true }, update: { companyId: companyId ?? null, name, slug, qaseProjectCode: code, source: src, active: true } });
      synced.push(pgToRecord(r));
    }
    return synced;
  }

  const db = readFile();
  const now = new Date().toISOString();
  const synced: AppRecord[] = [];

  for (const project of input.projects) {
    const code = normalizeProjectCode(project.code);
    if (!code) continue;

    const slug = normalizeSlug(code);
    const name = (project.title ?? code).trim() || code;
    const idx = db.items.findIndex((item) => {
      if (item.companySlug !== companySlug) return false;
      const sameCode = normalizeProjectCode(item.qaseProjectCode) === code;
      const sameSlug = normalizeSlug(item.slug ?? "") === slug;
      return sameCode || sameSlug;
    });
    const src = input.source ?? "qase";

    if (idx >= 0) {
      const current = db.items[idx];
      const updated: AppRecord = {
        ...current,
        companyId: current.companyId ?? companyId,
        companySlug,
        name,
        slug,
        qaseProjectCode: code,
        source: current.source ?? src,
        active: true,
        updatedAt: now,
      };
      db.items[idx] = updated;
      synced.push(updated);
      continue;
    }

    const created: AppRecord = {
      id: `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      companyId,
      companySlug,
      name,
      slug,
      description: null,
      qaseProjectCode: code,
      source: input.source ?? "qase",
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    db.items.unshift(created);
    db.counter = (db.counter || 0) + 1;
    synced.push(created);
  }

  if (synced.length > 0) {
    writeFile(db);
  }

  return synced;
}
