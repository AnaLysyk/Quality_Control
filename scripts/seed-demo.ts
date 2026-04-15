import "./loadEnv";
import { hashPasswordSha256 } from "../lib/passwordHash";
import { prisma } from "../lib/prismaClient";

const COMPANY = {
  name: "Demo",
  slug: "demo",
};

const USERS = {
  admin: {
    email: "admin@demo.test",
    name: "Demo Admin",
    role: "admin",
  },
  user: {
    email: "user@demo.test",
    name: "Demo User",
    role: "user",
  },
};

const PASSWORD = "Demo@123";

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
    update: { role: role as any },
    create: { user_id: userId, company_id: companyId, role: role as any },
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

  console.log("Seed Demo ok:", {
    company: COMPANY.slug,
    admin: USERS.admin.email,
    user: USERS.user.email,
  });
}

main()
  .catch((err) => {
    console.error("Seed Demo failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
