import "server-only";

import crypto from "node:crypto";
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

// ─── Memory fallback (no local file persistence) ─────────────────────────────

let memoryPlatformDocs: PlatformDocsStore = { categories: [], docs: [] };
const memoryCompanyDocs = new Map<string, PlatformDocsStore>();

// ─── Public API ───────────────────────────────────────────────────────────────

export async function readPlatformDocs(): Promise<PlatformDocsStore> {
  if (USE_POSTGRES) return pgReadDocs(null);
  return memoryPlatformDocs;
}

export async function writePlatformDocs(store: PlatformDocsStore): Promise<void> {
  if (USE_POSTGRES) { await pgWriteDocs(null, store); return; }
  memoryPlatformDocs = store;
}

export async function readCompanyDocs(companySlug: string): Promise<PlatformDocsStore> {
  if (USE_POSTGRES) return pgReadDocs(companySlug);
  return memoryCompanyDocs.get(companySlug) ?? { categories: [], docs: [] };
}

export async function writeCompanyDocs(companySlug: string, store: PlatformDocsStore): Promise<void> {
  if (USE_POSTGRES) { await pgWriteDocs(companySlug, store); return; }
  memoryCompanyDocs.set(companySlug, store);
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
