/**
 * Seed: insere overrides de permissão para TODOS os usuários cadastrados no banco.
 * Cada usuário recebe um override baseado no seu perfil real (globalRole / role / membership).
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Busca todos os usuários com suas memberships
  const users = await p.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      memberships: { select: { role: true, companyId: true } },
    },
  });
  const memberships = await p.membership.findMany({ select: { userId: true, role: true } });

  console.log(`Usuários encontrados: ${users.length}\n`);

  // Determina o perfil mais forte para decidir que override aplicar
  const ROLE_WEIGHT = { viewer: 0, user: 1, company_admin: 2, it_dev: 3 };

  function resolveStrongest(links) {
    let best = 'user';
    for (const l of links) {
      const r = (l.role || 'user').toLowerCase();
      if ((ROLE_WEIGHT[r] ?? 1) > (ROLE_WEIGHT[best] ?? 1)) best = r;
    }
    return best;
  }

  function resolvePermRole(user, links) {
    const strongest = resolveStrongest(links);
    if (user.is_global_admin || user.globalRole === 'global_admin') return 'admin';
    if (strongest === 'it_dev' || (user.role || '').toLowerCase() === 'it_dev') return 'dev';
    if (strongest === 'company_admin') return 'company';
    return 'user';
  }

  // Override padrão por perfil
  function buildOverride(permRole) {
    switch (permRole) {
      case 'admin':
        // Admins: proteção extra — não podem deletar usuários diretamente (fluxo de aprovação)
        return {
          allow: { audit: ['export'], ai: ['view', 'use'] },
          deny:  { users: ['delete'] },
        };
      case 'dev':
        // Devs: all access + export em todos os módulos relevantes
        return {
          allow: { runs: ['export'], releases: ['export'], applications: ['export'] },
          deny:  {},
        };
      case 'company':
        // Company admins: ganham view de releases e runs, perdem delete de aplicações
        return {
          allow: { releases: ['view'], runs: ['view'] },
          deny:  { applications: ['delete'] },
        };
      case 'user':
      default:
        // Viewers: ganham view de releases para acompanhar entregas
        return {
          allow: { releases: ['view'] },
          deny:  { support: ['floating'] },
        };
    }
  }

  const results = [];

  for (const user of users) {
    // Ignora usuários sem email real (emails muito curtos são logins legados)
    const userMemberships = memberships.filter((m) => m.userId === user.id);
    const permRole = resolvePermRole(user, userMemberships);
    const override = buildOverride(permRole);

    await p.userPermissionOverride.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, allow: override.allow, deny: override.deny, updatedBy: 'seed-script' },
      update: { allow: override.allow, deny: override.deny, updatedBy: 'seed-script' },
    });

    results.push({ email: user.email, permRole, allow: override.allow, deny: override.deny });
    console.log(`  ✅ [${permRole.padEnd(7)}] ${user.email} (id=${user.id})`);
    console.log(`          allow=${JSON.stringify(override.allow)}`);
    console.log(`          deny =${JSON.stringify(override.deny)}`);
  }

  const total = await p.userPermissionOverride.count();
  console.log(`\nTotal de overrides na tabela: ${total}`);
  await p.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
