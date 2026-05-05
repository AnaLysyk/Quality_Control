import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getJsonStoreDir } from "@/data/jsonStorePath";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocStatus = "draft" | "published" | "outdated";

export type DocBlock =
  | { id: string; type: "heading"; level: 1 | 2 | 3; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "card"; variant: "info" | "warning" | "danger" | "success" | "tip"; title?: string; text: string }
  | { id: string; type: "code"; language: string; code: string; caption?: string }
  | { id: string; type: "list"; ordered: boolean; items: string[] }
  | { id: string; type: "divider" }
  | { id: string; type: "table"; headers: string[]; rows: string[][]; caption?: string };

export type WikiCategory = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
};

export type WikiDoc = {
  id: string;
  categoryId: string;
  slug: string;
  title: string;
  description?: string;
  status: DocStatus;
  order: number;
  blocks: DocBlock[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type PlatformDocsStore = {
  categories: WikiCategory[];
  docs: WikiDoc[];
};

// ─── Postgres helpers ─────────────────────────────────────────────────────────

function pgCatToWikiCategory(r: { id: string; slug: string; title: string; description: string | null; icon: string | null; order: number; createdAt: Date; updatedAt: Date; createdBy: string | null }): WikiCategory {
  return { id: r.id, slug: r.slug, title: r.title, description: r.description ?? undefined, icon: r.icon ?? undefined, order: r.order, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), createdBy: r.createdBy };
}

function pgDocToWikiDoc(r: { id: string; categoryId: string; slug: string; title: string; description: string | null; status: string; order: number; blocks: unknown; createdAt: Date; updatedAt: Date; createdBy: string | null; updatedBy: string | null }): WikiDoc {
  return { id: r.id, categoryId: r.categoryId, slug: r.slug, title: r.title, description: r.description ?? undefined, status: r.status as DocStatus, order: r.order, blocks: Array.isArray(r.blocks) ? (r.blocks as DocBlock[]) : [], createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), createdBy: r.createdBy, updatedBy: r.updatedBy };
}

async function pgReadDocs(companySlug: string | null): Promise<PlatformDocsStore> {
  const prisma = await getPrisma();
  const where = companySlug ? { companySlug } : { companySlug: null };
  const [cats, docs] = await Promise.all([
    prisma.wikiCategory.findMany({ where, orderBy: { order: "asc" } }),
    prisma.wikiDoc.findMany({ where: { companySlug: companySlug ?? null }, orderBy: { order: "asc" } }),
  ]);
  return { categories: cats.map(pgCatToWikiCategory), docs: docs.map(pgDocToWikiDoc) };
}

async function pgWriteDocs(companySlug: string | null, store: PlatformDocsStore): Promise<void> {
  const prisma = await getPrisma();
  const where = companySlug ? { companySlug } : { companySlug: null };

  // Upsert categories
  for (const cat of store.categories) {
    await prisma.wikiCategory.upsert({
      where: { companySlug_slug: { companySlug: companySlug ?? "", slug: cat.slug } },
      create: { id: cat.id, companySlug: companySlug, slug: cat.slug, title: cat.title, description: cat.description ?? null, icon: cat.icon ?? null, order: cat.order, createdBy: cat.createdBy ?? null },
      update: { title: cat.title, description: cat.description ?? null, icon: cat.icon ?? null, order: cat.order },
    });
  }

  // Remove categories not in the new list
  const existingCats = await prisma.wikiCategory.findMany({ where, select: { id: true } });
  const newCatIds = new Set(store.categories.map((c) => c.id));
  for (const cat of existingCats) {
    if (!newCatIds.has(cat.id)) {
      await prisma.wikiCategory.delete({ where: { id: cat.id } });
    }
  }

  // Upsert docs
  for (const doc of store.docs) {
    await prisma.wikiDoc.upsert({
      where: { companySlug_slug: { companySlug: companySlug ?? "", slug: doc.slug } },
      create: { id: doc.id, categoryId: doc.categoryId, companySlug: companySlug, slug: doc.slug, title: doc.title, description: doc.description ?? null, status: doc.status, order: doc.order, blocks: doc.blocks as object[], createdBy: doc.createdBy ?? null, updatedBy: doc.updatedBy ?? null },
      update: { categoryId: doc.categoryId, title: doc.title, description: doc.description ?? null, status: doc.status, order: doc.order, blocks: doc.blocks as object[], updatedBy: doc.updatedBy ?? null },
    });
  }

  // Remove docs not in the new list
  const existingDocs = await prisma.wikiDoc.findMany({ where: { companySlug: companySlug ?? null }, select: { id: true } });
  const newDocIds = new Set(store.docs.map((d) => d.id));
  for (const doc of existingDocs) {
    if (!newDocIds.has(doc.id)) {
      await prisma.wikiDoc.delete({ where: { id: doc.id } });
    }
  }
}

// ─── JSON fallback (E2E / no-DB environments) ─────────────────────────────────

const SEED_PATH = path.join(process.cwd(), "data", "platform-docs.json");

function getStorePath() {
  return path.join(getJsonStoreDir(), "platform-docs.json");
}

async function ensureStore(): Promise<void> {
  const storePath = getStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    try {
      await fs.access(SEED_PATH);
      const seed = await fs.readFile(SEED_PATH, "utf8");
      await fs.writeFile(storePath, seed, "utf8");
    } catch {
      await fs.writeFile(storePath, JSON.stringify({ categories: [], docs: [] }, null, 2), "utf8");
    }
  }
}

async function readJsonStore(storePath: string): Promise<PlatformDocsStore> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PlatformDocsStore>;
    return {
      categories: Array.isArray(parsed.categories) ? (parsed.categories as WikiCategory[]) : [],
      docs: Array.isArray(parsed.docs) ? (parsed.docs as WikiDoc[]) : [],
    };
  } catch {
    return { categories: [], docs: [] };
  }
}

function getCompanyStorePath(companySlug: string) {
  return path.join(getJsonStoreDir(), `company-docs-${companySlug}.json`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function readPlatformDocs(): Promise<PlatformDocsStore> {
  if (USE_POSTGRES) return pgReadDocs(null);
  await ensureStore();
  return readJsonStore(getStorePath());
}

export async function writePlatformDocs(store: PlatformDocsStore): Promise<void> {
  if (USE_POSTGRES) { await pgWriteDocs(null, store); return; }
  await ensureStore();
  await fs.writeFile(getStorePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function readCompanyDocs(companySlug: string): Promise<PlatformDocsStore> {
  if (USE_POSTGRES) return pgReadDocs(companySlug);
  const storePath = getCompanyStorePath(companySlug);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  try { await fs.access(storePath); } catch { await fs.writeFile(storePath, JSON.stringify({ categories: [], docs: [] }, null, 2), "utf8"); }
  return readJsonStore(storePath);
}

export async function writeCompanyDocs(companySlug: string, store: PlatformDocsStore): Promise<void> {
  if (USE_POSTGRES) { await pgWriteDocs(companySlug, store); return; }
  const storePath = getCompanyStorePath(companySlug);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
