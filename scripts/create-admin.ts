import "./loadEnv";
import { prisma } from '../lib/prismaClient';
import { hashPasswordSha256 } from '../lib/passwordHash';

function getArgOrEnv(key: string, envKey: string, fallback?: string): string {
  const idx = process.argv.findIndex((a) => a === `--${key}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  if (process.env[envKey]) return process.env[envKey]!;
  if (fallback) return fallback;
  throw new Error(`Missing required argument/env: ${key}`);
}

async function createAdmin() {
  const email = getArgOrEnv("email", "ADMIN_EMAIL", "admin@test.com");
  const password = getArgOrEnv("password", "ADMIN_PASSWORD", "123456");
  const hashedPassword = hashPasswordSha256(password);

  try {
    // Criar empresa se não existir
    const company = await prisma.company.upsert({
      where: { slug: 'testing-company' },
      update: {},
      create: {
        name: 'Testing Company',
        slug: 'testing-company',
      },
    });

    // Criar usuário
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        name: 'Admin Test',
        active: true,
      },
    });

    // Associar usuário à empresa
    await prisma.userCompany.upsert({
      where: {
        user_id_company_id: {
          user_id: user.id,
          company_id: company.id,
        },
      },
      update: {},
      create: {
        user_id: user.id,
        company_id: company.id,
        role: 'admin',
      },
    });

    console.log('Admin user and company created or updated:', { email, company: company.slug });
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
