import "./loadEnv";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
import { hashPasswordSha256 } from "../lib/passwordHash";

const COMPANY = {
  name: "Griaule",
  slug: "griaule",
};

const USERS = {
  admin: {
    email: "admin@griaule.test",
    name: "Griaule Admin",
    role: "admin",
  },
  user: {
    email: "user@griaule.test",
    name: "Griaule User",
    role: "user",
  },
};

const PASSWORD = "Griaule@123";

async function upsertUser(email: string, name: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, password_hash: passwordHash, active: true },
    create: { email, name, password_hash: passwordHash, active: true },
  });
}

async function upsertLink(userId: string, companyId: string, role: string) {
  return prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: userId, company_id: companyId } },
    update: { role },
    create: { user_id: userId, company_id: companyId, role },
  });
}

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
    console.error("Seed Griaule failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
