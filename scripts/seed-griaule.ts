/**
 * scripts/seed-griaule.ts
 * Uso: npx tsx scripts/seed-griaule.ts
 *
 * - Permite override de dados via variáveis de ambiente
 * - Adiciona JSDoc e type safety
 * - Melhora logs de erro e comentários
 */

import "./loadEnv";
import { PrismaClient } from "@prisma/client";
import { hashPasswordSha256 } from "../lib/passwordHash";

const prisma = new PrismaClient();

const COMPANY = {
  name: process.env.SEED_COMPANY_NAME || "Griaule",
  slug: process.env.SEED_COMPANY_SLUG || "griaule",
};

const USERS = {
  admin: {
    email: process.env.SEED_ADMIN_EMAIL || "admin@griaule.test",
    name: process.env.SEED_ADMIN_NAME || "Griaule Admin",
    role: "admin" as const,
  },
  user: {
    email: process.env.SEED_USER_EMAIL || "user@griaule.test",
    name: process.env.SEED_USER_NAME || "Griaule User",
    role: "user" as const,
  },
};

const PASSWORD = process.env.SEED_PASSWORD || "Griaule@123";


/**
 * Upsert a user by email.
 * @param email User email
 * @param name User name
 * @param passwordHash Hashed password
 */
async function upsertUser(email: string, name: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, password_hash: passwordHash, active: true },
    create: { email, name, password_hash: passwordHash, active: true },
  });
}


/**
 * Upsert a user-company link with role.
 * @param userId User ID
 * @param companyId Company ID
 * @param role Role string
 */
async function upsertLink(userId: string, companyId: string, role: "admin" | "user") {
  return prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: userId, company_id: companyId } },
    update: { role },
    create: { user_id: userId, company_id: companyId, role },
  });
}


/**
 * Main seeding routine.
 */
async function main() {
  const passwordHash = hashPasswordSha256(PASSWORD);

  const company = await prisma.company.upsert({
    where: { slug: COMPANY.slug },
    update: { name: COMPANY.name },
    create: { name: COMPANY.name, slug: COMPANY.slug },
  });

  const adminUser = await upsertUser(USERS.admin.email, USERS.admin.name, passwordHash);
  const normalUser = await upsertUser(USERS.user.email, USERS.user.name, passwordHash);

  await upsertLink(adminUser.id, company.id, USERS.admin.role);
  await upsertLink(normalUser.id, company.id, USERS.user.role);

  console.log("Seed Griaule ok:", {
    company: COMPANY.slug,
    admin: USERS.admin.email,
    user: USERS.user.email,
  });
}


main()
  .catch((err) => {
    console.error("Seed Griaule failed:", err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch((e) => {
      console.error("Error disconnecting Prisma:", e);
    });
  });
