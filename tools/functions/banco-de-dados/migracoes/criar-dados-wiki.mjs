/**
 * seed-wiki.mjs — Migra platform-docs.json e company-docs-*.json para PostgreSQL (wiki_categories / wiki_docs).
 * Uso: node tools/functions/banco-de-dados/migracoes/criar-dados-wiki.mjs
 */

import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

config({ path: path.join(ROOT, ".env.local") });
config({ path: path.join(ROOT, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("ERRO: DATABASE_URL não definido.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
  log: ["warn", "error"],
});

async function upsertStore(companySlug, store) {
  const label = companySlug ?? "platform";
  console.log(`\n── Wiki: ${label} (${store.categories.length} cats, ${store.docs.length} docs) ──`);

  await prisma.$transaction(async (tx) => {
    // Delete existing so we don't get slug conflicts
    await tx.wikiDoc.deleteMany({ where: { companySlug } });
    await tx.wikiCategory.deleteMany({ where: { companySlug } });

    for (const cat of store.categories) {
      await tx.wikiCategory.create({
        data: {
          id: cat.id,
          companySlug: companySlug ?? null,
          slug: cat.slug,
          title: cat.title,
          description: cat.description ?? null,
          icon: cat.icon ?? null,
          order: cat.order ?? 0,
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
          companySlug: companySlug ?? null,
          slug: doc.slug,
          title: doc.title,
          description: doc.description ?? null,
          status: doc.status ?? "draft",
          order: doc.order ?? 0,
          blocks: Array.isArray(doc.blocks) ? doc.blocks : [],
          createdBy: doc.createdBy ?? null,
          updatedBy: doc.updatedBy ?? null,
          createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
          updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
        },
      });
    }
  });

  console.log(`  ✓ ${label} migrado`);
}

async function main() {
  console.log("=== seed-wiki: migrando JSON → PostgreSQL ===");

  // 1. Platform-level docs
  const platformPath = path.join(ROOT, "data", "platform-docs.json");
  try {
    const raw = await fs.readFile(platformPath, "utf8");
    const store = JSON.parse(raw);
    await upsertStore(null, store);
  } catch (err) {
    console.warn(`  Aviso: platform-docs.json não encontrado ou inválido — ${err.message}`);
  }

  // 2. Company-specific docs (company-docs-*.json)
  const dataDir = path.join(ROOT, "data");
  const files = await fs.readdir(dataDir);
  const companyDocFiles = files.filter((f) => f.startsWith("company-docs-") && f.endsWith(".json"));

  for (const file of companyDocFiles) {
    const slug = file.replace("company-docs-", "").replace(".json", "");
    const filePath = path.join(dataDir, file);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const store = JSON.parse(raw);
      await upsertStore(slug, store);
    } catch (err) {
      console.warn(`  Aviso: ${file} inválido — ${err.message}`);
    }
  }

  await prisma.$disconnect();
  console.log("\n=== seed-wiki: concluído ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
