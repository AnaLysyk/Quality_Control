/**
 * seed-pg.mjs — Migra usuários, empresas e memberships do JSON local para PostgreSQL.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node --experimental-vm-modules scripts/seed-pg.mjs
 *
 * Ou via npx:
 *   npx tsx scripts/seed-pg.mjs
 *
 * Lê data/local-auth-store.json (ou data/local-auth-store.sample.json como fallback)
 * e faz UPSERT de todos os registros no PostgreSQL.
 */

import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local para pegar DATABASE_URL localmente
config({ path: path.join(ROOT, ".env.local") });
config({ path: path.join(ROOT, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("ERRO: DATABASE_URL não definido. Configure no .env.local ou passe via env.");
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function readStore() {
  const runtimePath = path.join(ROOT, "data", "local-auth-store.json");
  const samplePath = path.join(ROOT, "data", "local-auth-store.sample.json");

  for (const filePath of [runtimePath, samplePath]) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed?.users) {
        console.log(`Lendo de: ${path.relative(ROOT, filePath)}`);
        return parsed;
      }
    } catch {
      // try next
    }
  }
  throw new Error("Nenhum arquivo local-auth-store.json encontrado.");
}

function normalizeSlug(v) {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function seedUsers(users) {
  console.log(`\n── Usuários (${users.length}) ──`);
  let created = 0;
  let skipped = 0;

  for (const u of users) {
    if (!u.email || !u.password_hash) {
      console.warn(`  Pulando usuário sem email/senha: ${u.id}`);
      skipped++;
      continue;
    }

    const email = u.email.trim().toLowerCase();
    const login = (u.user ?? "").trim().toLowerCase() || email.split("@")[0];

    try {
      await prisma.user.upsert({
        where: { email },
        create: {
          id: u.id ?? undefined,
          name: u.name ?? email,
          full_name: u.full_name ?? null,
          email,
          user: login || null,
          password_hash: u.password_hash,
          role: u.role ?? "user",
          globalRole: u.globalRole ?? null,
          status: u.status ?? "active",
          active: u.active ?? true,
          is_global_admin: u.is_global_admin ?? false,
          avatar_key: u.avatar_key ?? null,
          avatar_url: u.avatar_url ?? null,
          job_title: u.job_title ?? null,
          linkedin_url: u.linkedin_url ?? null,
          phone: u.phone ?? null,
          default_company_slug: u.default_company_slug ?? null,
          ...(u.createdAt ? { createdAt: new Date(u.createdAt) } : {}),
        },
        update: {
          name: u.name ?? email,
          full_name: u.full_name ?? null,
          role: u.role ?? "user",
          globalRole: u.globalRole ?? null,
          status: u.status ?? "active",
          active: u.active ?? true,
          is_global_admin: u.is_global_admin ?? false,
          job_title: u.job_title ?? null,
          linkedin_url: u.linkedin_url ?? null,
          phone: u.phone ?? null,
          default_company_slug: u.default_company_slug ?? null,
        },
      });
      console.log(`  ✓ ${email} (${u.is_global_admin ? "global_admin" : u.role ?? "user"})`);
      created++;
    } catch (err) {
      const msg = err?.message ?? String(err);
      // Unique constraint on `user` login — try with a disambiguated login
      if (err?.code === "P2002" && err?.meta?.target?.includes("user")) {
        const fallbackLogin = `${login}.${Date.now().toString(36)}`;
        try {
          await prisma.user.upsert({
            where: { email },
            create: {
              id: u.id ?? undefined,
              name: u.name ?? email,
              full_name: u.full_name ?? null,
              email,
              user: fallbackLogin,
              password_hash: u.password_hash,
              role: u.role ?? "user",
              globalRole: u.globalRole ?? null,
              status: u.status ?? "active",
              active: u.active ?? true,
              is_global_admin: u.is_global_admin ?? false,
            },
            update: {
              name: u.name ?? email,
              full_name: u.full_name ?? null,
              role: u.role ?? "user",
              globalRole: u.globalRole ?? null,
            },
          });
          console.log(`  ✓ ${email} (login renomeado para ${fallbackLogin})`);
          created++;
        } catch (e2) {
          console.error(`  ✗ ${email}: ${e2?.message}`);
          skipped++;
        }
      } else {
        console.error(`  ✗ ${email}: ${msg}`);
        skipped++;
      }
    }
  }

  console.log(`  → ${created} inseridos/atualizados, ${skipped} pulados`);
}

async function seedCompanies(companies) {
  console.log(`\n── Empresas (${companies.length}) ──`);
  let created = 0;
  let skipped = 0;

  for (const c of companies) {
    if (!c.name) {
      skipped++;
      continue;
    }

    const slug = normalizeSlug(c.slug ?? c.name);

    try {
      await prisma.company.upsert({
        where: { slug },
        create: {
          id: c.id ?? undefined,
          name: c.name.trim(),
          company_name: c.company_name ?? c.name.trim(),
          slug,
          status: c.status ?? "active",
          active: c.active ?? true,
          tax_id: c.tax_id ?? null,
          address: c.address ?? null,
          phone: c.phone ?? null,
          website: c.website ?? null,
          logo_url: c.logo_url ?? null,
          docs_link: c.docs_link ?? null,
          notes: c.notes ?? null,
          cep: c.cep ?? null,
          linkedin_url: c.linkedin_url ?? null,
          qase_project_code: c.qase_project_code ?? null,
          jira_base_url: c.jira_base_url ?? null,
          jira_email: c.jira_email ?? null,
          jira_api_token: c.jira_api_token ?? null,
          integration_mode: c.integration_mode ?? "none",
          short_description: c.short_description ?? null,
          internal_notes: c.internal_notes ?? null,
          ...(c.createdAt ? { createdAt: new Date(c.createdAt) } : {}),
        },
        update: {
          name: c.name.trim(),
          company_name: c.company_name ?? c.name.trim(),
          status: c.status ?? "active",
          active: c.active ?? true,
          logo_url: c.logo_url ?? null,
          docs_link: c.docs_link ?? null,
          qase_project_code: c.qase_project_code ?? null,
          jira_base_url: c.jira_base_url ?? null,
          jira_email: c.jira_email ?? null,
          jira_api_token: c.jira_api_token ?? null,
          integration_mode: c.integration_mode ?? undefined,
        },
      });
      console.log(`  ✓ ${c.name} (${slug})`);
      created++;
    } catch (err) {
      console.error(`  ✗ ${c.name}: ${err?.message}`);
      skipped++;
    }
  }

  console.log(`  → ${created} inseridas/atualizadas, ${skipped} puladas`);
}

async function seedMemberships(memberships, links) {
  const all = [
    ...(memberships ?? []).map((m) => ({
      userId: m.userId,
      companyId: m.companyId,
      role: m.role ?? "user",
      capabilities: m.capabilities ?? [],
    })),
    ...(links ?? []).map((l) => ({
      userId: l.user_id,
      companyId: l.company_id,
      role: l.role ?? "user",
      capabilities: l.permissions ?? [],
    })),
  ];

  // Deduplicate by userId+companyId
  const seen = new Set();
  const unique = all.filter((m) => {
    const key = `${m.userId}:${m.companyId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n── Memberships (${unique.length}) ──`);
  let created = 0;
  let skipped = 0;

  for (const m of unique) {
    if (!m.userId || !m.companyId) { skipped++; continue; }

    // Check if user and company exist in DB
    const [userExists, companyExists] = await Promise.all([
      prisma.user.findUnique({ where: { id: m.userId }, select: { id: true } }),
      prisma.company.findUnique({ where: { id: m.companyId }, select: { id: true } }),
    ]);

    if (!userExists || !companyExists) {
      console.warn(`  Pulando membership: user ${m.userId} ou empresa ${m.companyId} não existe`);
      skipped++;
      continue;
    }

    try {
      await prisma.membership.upsert({
        where: { userId_companyId: { userId: m.userId, companyId: m.companyId } },
        create: { userId: m.userId, companyId: m.companyId, role: m.role, capabilities: m.capabilities },
        update: { role: m.role, capabilities: m.capabilities },
      });
      created++;
    } catch (err) {
      console.error(`  ✗ ${m.userId} → ${m.companyId}: ${err?.message}`);
      skipped++;
    }
  }

  console.log(`  → ${created} inseridos/atualizados, ${skipped} pulados`);
}

async function main() {
  console.log("=== seed-pg: Migrando auth store local → PostgreSQL ===\n");

  // Verify connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Conexão com PostgreSQL: OK");
  } catch (err) {
    console.error("Falha ao conectar no PostgreSQL:", err.message);
    process.exit(1);
  }

  const store = await readStore();
  const users = store.users ?? [];
  const companies = store.companies ?? [];
  const memberships = store.memberships ?? [];
  const links = store.links ?? [];

  await seedCompanies(companies);
  await seedUsers(users);
  await seedMemberships(memberships, links);

  console.log("\n✅ Seed concluído!");
}

main()
  .catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
