import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";
import { prisma } from "@/lib/prismaClient";
import { hashPasswordSha256 } from "@/lib/passwordHash";

async function createAdmin() {
  const email = 'admin@test.com';
  const password = '123456';
  const hashedPassword = hashPasswordSha256(password);

  try {
    // Criar empresa se nÃ£o existir
    const company = await prisma.company.upsert({
      where: { slug: 'testing-company' },
      update: {},
      create: {
        name: 'Testing Company',
        slug: 'testing-company',
      },
    });

    // Criar usuÃ¡rio
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

    // Associar usuÃ¡rio Ã  empresa
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

    console.log('Admin user and company created:', { user, company });
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

