#!/usr/bin/env node

/**
 * Script para criar automaticamente os dois usuários de suporte técnico
 * Faz POST direto na API /api/admin/users
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const log = (color, ...args) => console.log(`${color}${args.join(' ')}${colors.reset}`);

const supportUsers = [
  {
    full_name: 'Thiago Perius da Silva',
    name: 'thiago.silva',
    email: 'thiago.silva@testingcompany.com.br',
    phone: '+55 11 99524-6699',
    job_title: 'Technical Support Specialist',
    linkedin_url: 'https://www.linkedin.com/in/thiago-silva',
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
    role: 'technical_support',
    active: true,
  },
];

async function createSupportUsers(adminToken) {
  const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  log(colors.bright + colors.blue, '\n🚀 CRIANDO USUÁRIOS DE SUPORTE TÉCNICO\n');

  let successCount = 0;
  let failureCount = 0;

  for (const user of supportUsers) {
    log(colors.bright + colors.cyan, `\n📝 Criando: ${user.full_name}`);
    log(colors.cyan, `   Email: ${user.email}`);

    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        log(colors.red, `   ❌ Erro: ${error.error || 'Falha ao criar usuário'}`);
        failureCount++;
        continue;
      }

      const result = await response.json();
      log(colors.green, `   ✅ Usuário criado com sucesso!`);
      log(colors.white, `   ID: ${result.id}`);
      log(colors.white, `   Login: ${result.user?.user || user.name}`);
      log(colors.yellow, `   📧 Email será enviado para: ${user.email}`);
      successCount++;
    } catch (err) {
      log(colors.red, `   ❌ Erro de conexão: ${err.message}`);
      failureCount++;
    }
  }

  log(colors.bright + colors.cyan, '\n' + '═'.repeat(70));
  log(colors.bright + colors.green, `\n✅ Resultado: ${successCount} criado(s), ${failureCount} erro(s)\n`);

  if (failureCount > 0) {
    log(colors.yellow, '💡 Se tiver erro de autenticação:');
    log(colors.white, '   1. Certifique-se de estar logado como admin global');
    log(colors.white, '   2. Passe o token correto como argumento:');
    log(colors.white, '      node support/functions/banco-de-dados/usuarios/criar-usuarios-suporte-auto.js <TOKEN_ADMIN>\n');
  }
}

// Obter token do argumento ou variável de ambiente
const adminToken = process.argv[2] || process.env.ADMIN_TOKEN;

if (!adminToken) {
  log(colors.red, '\n❌ Token de admin não fornecido\n');
  log(colors.yellow, 'Use:\n');
  log(colors.white, '  node support/functions/banco-de-dados/usuarios/criar-usuarios-suporte-auto.js <TOKEN_ADMIN>\n');
  log(colors.white, 'Ou defina a variável de ambiente:\n');
  log(colors.white, '  ADMIN_TOKEN=sua_senha node support/functions/banco-de-dados/usuarios/criar-usuarios-suporte-auto.js\n');
  process.exit(1);
}

createSupportUsers(adminToken).catch(err => {
  log(colors.red, `\n❌ Erro fatal: ${err.message}\n`);
  process.exit(1);
});
