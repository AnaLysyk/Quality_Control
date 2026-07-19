#!/usr/bin/env node

/**
 * Script para criar dois usuários de suporte técnico
 * - thiago.silva@testingcompany.com.br
 * - barbara@testingcompany.com.br
 */

require('dotenv').config({ path: '.env.local' });

const supportUsers = [
  {
    full_name: 'Thiago Perius da Silva',
    name: 'thiago.silva',
    email: 'thiago.silva@testingcompany.com.br',
    phone: '+55 11 99524-6699',
    job_title: 'Technical Support Specialist',
    linkedin_url: 'https://www.linkedin.com/in/thiago-silva',
    avatar_url: null,
    role: 'technical_support',
    active: true,
  },
  {
    full_name: 'Bárbara Martins da Silveira',
    name: 'barbara.martins',
    email: 'barbara@testingcompany.com.br',
    phone: '+55 11 99648-4745',
    job_title: 'Technical Support Specialist',
    linkedin_url: 'https://www.linkedin.com/in/barbara-silveira',
    avatar_url: null,
    role: 'technical_support',
    active: true,
  },
];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = (color, ...args) => console.log(`${color}${args.join(' ')}${colors.reset}`);

async function createUsers() {
  const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  // Tentar obter token de um user admin existente no banco (mock)
  // Em produção, você precisa estar autenticado como admin global
  
  log(colors.bright + colors.blue, '\n🚀 CRIANDO USUÁRIOS DE SUPORTE TÉCNICO\n');

  for (const user of supportUsers) {
    log(colors.bright + colors.cyan, `\n📝 Criando: ${user.full_name}`);
    log(colors.cyan, `   Email: ${user.email}`);
    log(colors.cyan, `   Login: ${user.name}`);
    
    // Payload que seria enviado para /api/admin/users
    const payload = {
      full_name: user.full_name,
      name: user.name,
      email: user.email,
      phone: user.phone,
      job_title: user.job_title,
      linkedin_url: user.linkedin_url,
      avatar_url: user.avatar_url,
      role: user.role,
      active: user.active,
    };

    log(colors.yellow, '\n   📋 Payload:');
    log(colors.white, JSON.stringify(payload, null, 2).split('\n').map(l => '   ' + l).join('\n'));

    log(colors.yellow, '\n   📧 Email será enviado com:');
    log(colors.white, `   • Para: ${user.email}`);
    log(colors.white, `   • Login: ${user.name}`);
    log(colors.white, `   • Senha: [GERADA AUTOMATICAMENTE]`);
    log(colors.white, `   • Assunto: Seus dados de acesso - Quality Control`);

    log(colors.bright + colors.green, '\n   ✅ Pronto para criar\n');

    // Para criar realmente, precisa fazer POST:
    // curl -X POST http://localhost:3000/api/admin/users \
    //   -H "Authorization: Bearer TOKEN_ADMIN" \
    //   -H "Content-Type: application/json" \
    //   -d '{payload}'
  }

  log(colors.bright + colors.cyan, '\n' + '═'.repeat(70));
  log(colors.bright + colors.yellow, '\n💡 Como criar os usuários:\n');
  log(colors.white, '1. Acesse http://localhost:3000/admin/users');
  log(colors.white, '2. Clique em "Criar Usuário"');
  log(colors.white, '3. Use os dados acima (copie o payload)');
  log(colors.white, '4. Selecione role: "technical_support"');
  log(colors.white, '5. Clique em "Criar"');
  log(colors.white, '\n   OU use curl:\n');

  for (const user of supportUsers) {
    const payload = {
      full_name: user.full_name,
      name: user.name,
      email: user.email,
      phone: user.phone,
      job_title: user.job_title,
      linkedin_url: user.linkedin_url,
      avatar_url: user.avatar_url,
      role: user.role,
      active: user.active,
    };

    log(colors.yellow, `   # ${user.full_name}\n`);
    log(colors.white, `   curl -X POST http://localhost:3000/api/admin/users \\`);
    log(colors.white, `     -H "Authorization: Bearer <TOKEN_ADMIN_AQUI>" \\`);
    log(colors.white, `     -H "Content-Type: application/json" \\`);
    log(colors.white, `     -d '${JSON.stringify(payload)}'`);
    log(colors.white, '');
  }

  log(colors.bright + colors.green, '\n✅ Emails de boas-vindas serão enviados automaticamente!\n');
}

createUsers().catch(err => {
  log(colors.red, `\n❌ Erro: ${err.message}`);
  process.exit(1);
});
