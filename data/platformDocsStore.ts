import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getJsonStoreDir } from "@/data/jsonStorePath";

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

// ─── Storage ──────────────────────────────────────────────────────────────────

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
    // Copy seed if available, otherwise write empty store
    try {
      await fs.access(SEED_PATH);
      const seed = await fs.readFile(SEED_PATH, "utf8");
      await fs.writeFile(storePath, seed, "utf8");
    } catch {
      await fs.writeFile(
        storePath,
        JSON.stringify({ categories: [], docs: [] } satisfies PlatformDocsStore, null, 2),
        "utf8",
      );
    }
  }
}

export async function readPlatformDocs(): Promise<PlatformDocsStore> {
  await ensureStore();
  const raw = await fs.readFile(getStorePath(), "utf8");
  const parsed = JSON.parse(raw) as Partial<PlatformDocsStore>;
  return {
    categories: Array.isArray(parsed.categories) ? (parsed.categories as WikiCategory[]) : [],
    docs: Array.isArray(parsed.docs) ? (parsed.docs as WikiDoc[]) : [],
  };
}

export async function writePlatformDocs(store: PlatformDocsStore): Promise<void> {
  await ensureStore();
  await fs.writeFile(getStorePath(), JSON.stringify(store, null, 2), "utf8");
}

// ─── Company-scoped wiki storage ──────────────────────────────────────────────

function getCompanyStorePath(companySlug: string) {
  return path.join(getJsonStoreDir(), `company-docs-${companySlug}.json`);
}

async function ensureCompanyStore(companySlug: string): Promise<void> {
  const storePath = getCompanyStorePath(companySlug);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(
      storePath,
      JSON.stringify({ categories: [], docs: [] } satisfies PlatformDocsStore, null, 2),
      "utf8",
    );
  }
}

export async function readCompanyDocs(companySlug: string): Promise<PlatformDocsStore> {
  await ensureCompanyStore(companySlug);
  const raw = await fs.readFile(getCompanyStorePath(companySlug), "utf8");
  const parsed = JSON.parse(raw) as Partial<PlatformDocsStore>;
  return {
    categories: Array.isArray(parsed.categories) ? (parsed.categories as WikiCategory[]) : [],
    docs: Array.isArray(parsed.docs) ? (parsed.docs as WikiDoc[]) : [],
  };
}

export async function writeCompanyDocs(companySlug: string, store: PlatformDocsStore): Promise<void> {
  await ensureCompanyStore(companySlug);
  await fs.writeFile(getCompanyStorePath(companySlug), JSON.stringify(store, null, 2), "utf8");
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
