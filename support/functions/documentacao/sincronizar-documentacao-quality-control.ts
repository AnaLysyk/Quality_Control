/// <reference types="node" />

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  buildQualityControlOfficialDocsStore,
  mergePlatformDocsStore,
  QUALITY_CONTROL_OFFICIAL_COMPANY_SLUG,
} from "../../../lib/documentation/qualityControlOfficialDocs";

const QUALITY_CONTROL_PROJECT_SLUG = "quality-control";

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, processEnv: process.env, quiet: true });
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL);
}

type PrismaClientLike = typeof import("../../../lib/prismaClient")["prisma"];

async function resolveTestingCompany(prisma: PrismaClientLike) {
  const exact = await prisma.company.findUnique({
    where: { slug: QUALITY_CONTROL_OFFICIAL_COMPANY_SLUG },
  });
  if (exact) return { company: exact, created: false };

  const sameName = await prisma.company.findMany({
    where: {
      OR: [
        { name: { equals: "Testing Company", mode: "insensitive" } },
        { company_name: { equals: "Testing Company", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (sameName.length === 1) {
    return { company: sameName[0], created: false };
  }

  if (sameName.length > 1) {
    throw new Error(
      `Foram encontradas empresas duplicadas para Testing Company: ${sameName.map((company) => `${company.name} (${company.slug})`).join(", ")}. Nenhuma foi apagada automaticamente.`,
    );
  }

  const created = await prisma.company.create({
    data: {
      name: "Testing Company",
      company_name: "Testing Company",
      slug: QUALITY_CONTROL_OFFICIAL_COMPANY_SLUG,
      status: "active",
      active: true,
      notes: "Empresa oficial usada para documentacao do proprio produto Quality Control.",
      short_description: "Contexto oficial para a documentacao rastreavel do Quality Control.",
    },
  });

  return { company: created, created: true };
}

async function ensureQualityControlProject(prisma: PrismaClientLike, companyId: string) {
  return prisma.project.upsert({
    where: {
      companyId_slug: {
        companyId,
        slug: QUALITY_CONTROL_PROJECT_SLUG,
      },
    },
    update: {
      name: "Quality Control",
      description: "Projeto oficial para documentacao, testes e governanca do proprio produto Quality Control.",
      status: "active",
      color: "#2563eb",
      iconKey: "folder",
      archivedAt: null,
      archivedById: null,
    },
    create: {
      companyId,
      slug: QUALITY_CONTROL_PROJECT_SLUG,
      name: "Quality Control",
      description: "Projeto oficial para documentacao, testes e governanca do proprio produto Quality Control.",
      status: "active",
      color: "#2563eb",
      iconKey: "folder",
    },
  });
}

async function readExistingCompanyDocs(prisma: PrismaClientLike, companySlug: string) {
  const [categories, docs] = await Promise.all([
    prisma.wikiCategory.findMany({
      where: { companySlug },
      orderBy: { order: "asc" },
    }),
    prisma.wikiDoc.findMany({
      where: { companySlug },
      orderBy: { order: "asc" },
    }),
  ]);

  return {
    categories: categories.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      description: item.description ?? undefined,
      icon: item.icon ?? undefined,
      order: item.order,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      createdBy: item.createdBy ?? undefined,
    })),
    docs: docs.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      slug: item.slug,
      title: item.title,
      description: item.description ?? undefined,
      status: item.status as "draft" | "published" | "outdated",
      order: item.order,
      blocks: Array.isArray(item.blocks) ? (item.blocks as Array<Record<string, unknown>>) : [],
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      createdBy: item.createdBy ?? undefined,
      updatedBy: item.updatedBy ?? undefined,
    })),
  };
}

async function writeCompanyDocs(prisma: PrismaClientLike, companySlug: string) {
  const officialStore = buildQualityControlOfficialDocsStore();
  const existingStore = await readExistingCompanyDocs(prisma, companySlug);
  const merged = mergePlatformDocsStore(officialStore, existingStore);

  await prisma.$transaction(
    async (tx) => {
      await tx.wikiDoc.deleteMany({ where: { companySlug } });
      await tx.wikiCategory.deleteMany({ where: { companySlug } });

      for (const category of merged.categories) {
        await tx.wikiCategory.create({
          data: {
            id: category.id,
            companySlug,
            slug: category.slug,
            title: category.title,
            description: category.description ?? null,
            icon: category.icon ?? null,
            order: category.order,
            createdBy: category.createdBy ?? null,
            createdAt: new Date(category.createdAt),
            updatedAt: new Date(category.updatedAt),
          },
        });
      }

      for (const doc of merged.docs) {
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
            createdAt: new Date(doc.createdAt),
            updatedAt: new Date(doc.updatedAt),
          },
        });
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  return merged;
}

async function main() {
  if (!hasDatabaseUrl()) {
    throw new Error(
      "DATABASE_URL, POSTGRES_PRISMA_URL ou POSTGRES_URL nao configurado. A sincronizacao oficial da Testing Company precisa de banco para criar empresa, projeto e wiki.",
    );
  }

  const { prisma } = await import("../../../lib/prismaClient");
  const { company, created } = await resolveTestingCompany(prisma);
  const project = await ensureQualityControlProject(prisma, company.id);
  const store = await writeCompanyDocs(prisma, company.slug);

  console.log(`[docs:sync-quality-control] Empresa alvo: ${company.name} (${company.slug})`);
  console.log(`[docs:sync-quality-control] Empresa ${created ? "criada" : "reutilizada"} com seguranca.`);
  console.log(`[docs:sync-quality-control] Projeto oficial: ${project.name} (${project.slug})`);
  console.log(`[docs:sync-quality-control] Categorias sincronizadas: ${store.categories.length}`);
  console.log(`[docs:sync-quality-control] Documentos sincronizados: ${store.docs.length}`);
}

main()
  .catch((error) => {
    console.error("[docs:sync-quality-control] Falha ao sincronizar documentacao oficial.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../../../lib/prismaClient").catch(() => ({ prisma: null }));
    await prisma?.$disconnect().catch(() => {});
  });
