import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";

import { randomUUID } from "crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { emailService } from "@/lib/email";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { prisma } from "@/lib/prismaClient";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });

type SupportUserSeed = {
  full_name: string;
  name: string;
  email: string;
  phone: string;
  job_title: string;
  linkedin_url: string;
};

const supportUsers: SupportUserSeed[] = [
  {
    full_name: "Thiago Perius da Silva",
    name: "thiago.silva",
    email: "thiago.silva@testingcompany.com.br",
    phone: "+55 11 99524-6699",
    job_title: "Technical Support Specialist",
    linkedin_url: "https://www.linkedin.com/in/thiago-silva",
  },
  {
    full_name: "Barbara Martins da Silveira",
    name: "barbara.martins",
    email: "barbara@testingcompany.com.br",
    phone: "+55 11 99648-4745",
    job_title: "Technical Support Specialist",
    linkedin_url: "https://www.linkedin.com/in/barbara-silveira",
  },
];

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function log(color: string, message: string) {
  // eslint-disable-next-line no-console
  console.log(`${color}${message}${colors.reset}`);
}

function generateTempPassword() {
  const raw = randomUUID().replace(/-/g, "");
  return raw.charAt(0).toUpperCase() + raw.slice(1, 9) + "!";
}

async function upsertSupportUsersAndSendWelcomeEmails() {
  log(colors.bright + colors.blue, "\nðŸš€ Criando/atualizando usuÃ¡rios de suporte tÃ©cnico\n");

  for (const seed of supportUsers) {
    const email = seed.email.trim().toLowerCase();
    const fullName = seed.full_name.trim();
    const login = seed.name.trim().toLowerCase();
    const tempPassword = generateTempPassword();
    const passwordHash = hashPasswordSha256(tempPassword);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    await prisma.user.upsert({
      where: { email },
      update: {
        full_name: fullName,
        name: fullName,
        user: login,
        phone: seed.phone,
        job_title: seed.job_title,
        linkedin_url: seed.linkedin_url,
        role: "technical_support",
        active: true,
        password_hash: passwordHash,
      },
      create: {
        full_name: fullName,
        name: fullName,
        email,
        user: login,
        phone: seed.phone,
        job_title: seed.job_title,
        linkedin_url: seed.linkedin_url,
        role: "technical_support",
        active: true,
        password_hash: passwordHash,
      },
    });

    if (existing) {
      log(colors.yellow, `ðŸ”„ Atualizado: ${fullName} (${email})`);
    } else {
      log(colors.green, `âœ… Criado: ${fullName} (${email})`);
    }

    const sent = await emailService.sendWelcomeEmail(email, login, tempPassword, fullName);
    if (sent) {
      log(colors.green, `ðŸ“§ E-mail enviado para ${email}`);
    } else {
      log(colors.red, `âŒ Falha ao enviar e-mail para ${email}`);
    }
  }

  log(colors.bright + colors.cyan, "\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
  log(colors.bright + colors.green, "âœ… Processo finalizado com sucesso.\n");
}

upsertSupportUsersAndSendWelcomeEmails().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log(colors.red, `âŒ Erro fatal: ${message}`);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

