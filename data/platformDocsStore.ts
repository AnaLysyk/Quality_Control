import "server-only";

import crypto from "node:crypto";
import { getOfficialCompanyDocsForSlug, mergePlatformDocsStore } from "@/lib/documentation/qualityControlOfficialDocs";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Prisma helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

function mapCategory(row: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}): WikiCategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    icon: row.icon ?? undefined,
    order: row.order,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
  };
}

function mapDoc(row: {
  id: string;
  categoryId: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
  blocks: unknown;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}): WikiDoc {
  return {
    id: row.id,
    categoryId: row.categoryId,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as DocStatus,
    order: row.order,
    blocks: Array.isArray(row.blocks) ? (row.blocks as DocBlock[]) : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

async function upsertStore(companySlug: string | null, store: PlatformDocsStore): Promise<void> {
  const prisma = await getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.wikiDoc.deleteMany({ where: { companySlug } });
    await tx.wikiCategory.deleteMany({ where: { companySlug } });
    for (const cat of store.categories) {
      await tx.wikiCategory.create({
        data: {
          id: cat.id,
          companySlug,
          slug: cat.slug,
          title: cat.title,
          description: cat.description ?? null,
          icon: cat.icon ?? null,
          order: cat.order,
          createdBy: cat.createdBy ?? null,
          createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date(),
          updatedAt: cat.updatedAt ? new Date(cat.updatedAt) : new Date(),
        },
      });
    }
    for (const doc of store.docs) {
      await tx.wikiDoc.create({
        data: {
          id: doc.id,
          categoryId: doc.categoryId,
          companySlug,
          slug: doc.slug,
          title: doc.title,
          description: doc.description ?? null,
          status: doc.status,
          order: doc.order,
          blocks: doc.blocks as object,
          createdBy: doc.createdBy ?? null,
          updatedBy: doc.updatedBy ?? null,
          createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
          updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
        },
      });
    }
  });
}

// â”€â”€â”€ Platform-level wiki (companySlug = null) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function readPlatformDocs(): Promise<PlatformDocsStore> {
  const prisma = await getPrisma();
  const [categories, docs] = await Promise.all([
    prisma.wikiCategory.findMany({ where: { companySlug: null }, orderBy: { order: "asc" } }),
    prisma.wikiDoc.findMany({ where: { companySlug: null }, orderBy: { order: "asc" } }),
  ]);
  return { categories: categories.map(mapCategory), docs: docs.map(mapDoc) };
}

export async function writePlatformDocs(store: PlatformDocsStore): Promise<void> {
  await upsertStore(null, store);
}

// â”€â”€â”€ Company-scoped wiki â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function readCompanyDocs(companySlug: string): Promise<PlatformDocsStore> {
  const prisma = await getPrisma();
  const [categories, docs] = await Promise.all([
    prisma.wikiCategory.findMany({ where: { companySlug }, orderBy: { order: "asc" } }),
    prisma.wikiDoc.findMany({ where: { companySlug }, orderBy: { order: "asc" } }),
  ]);
  const stored = { categories: categories.map(mapCategory), docs: docs.map(mapDoc) };
  const official = getOfficialCompanyDocsForSlug(companySlug);
  return official ? mergePlatformDocsStore(stored, official) : stored;
}

export async function writeCompanyDocs(companySlug: string, store: PlatformDocsStore): Promise<void> {
  await upsertStore(companySlug, store);
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
