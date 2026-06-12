#!/usr/bin/env node

/**
 * Script para enviar email de teste para paulalysyk123@gmail.com
 * Com template de boas-vindas completo
 */

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

function generateTempPassword() {
  const rawTemp = crypto.randomUUID().replace(/-/g, '');
  return rawTemp.charAt(0).toUpperCase() + rawTemp.slice(1, 9) + '!';
}

function generateWelcomeEmailHtml(fullName, login, tempPassword) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quality-control-qwqs.onrender.com';
  const loginUrl = `${baseUrl.replace(/\/+$/, '')}/login`;
  const greeting = fullName ? `Olá, ${fullName}!` : 'Olá!';

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Bem-vindo ao Testing Company - Quality Control</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #27457d; margin: 0; padding: 0; background: #f4f6fb; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .email-body { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #011848 0%, #02307a 100%); color: white; padding: 32px 24px; text-align: center; border-bottom: 4px solid #ef0001; }
      .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
      .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
      .content { padding: 32px 24px; }
      .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #081f4d; }
      .intro-text { color: #27457d; margin-bottom: 24px; }
      .cred-box { background: #f9fafb; border: 2px solid #d8dfeb; border-radius: 8px; padding: 20px; margin: 24px 0; font-family: 'Courier New', monospace; }
      .cred-box-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
      .cred-row { margin: 8px 0; display: flex; justify-content: space-between; align-items: center; }
      .cred-label { color: #6b7280; font-size: 13px; font-weight: 500; }
      .cred-value { color: #011848; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; }
      .button { display: inline-block; padding: 12px 32px; background: #ef0001; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 15px; font-weight: 600; }
      .button:hover { background: #c70000; color: #ffffff !important; }
      .warning-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 13px; }
      .warning-box strong { color: #b45309; }
      .steps { margin: 24px 0; }
      .step { margin: 12px 0; padding-left: 24px; position: relative; color: #27457d; font-size: 13px; }
      .step::before { content: attr(data-step); position: absolute; left: 0; top: -2px; width: 20px; height: 20px; background: #ef0001; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
      .divider { height: 1px; background: #d8dfeb; margin: 24px 0; }
      .footer { background: #f9fafb; padding: 20px 24px; text-align: center; border-top: 1px solid #d8dfeb; font-size: 12px; color: #5f77a2; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="email-body">
        <div class="header">
          <h1>Testing Company</h1>
          <p>Quality Control - Bem-vindo à plataforma</p>
        </div>
        <div class="content">
          <p class="greeting">${greeting}</p>
          <p class="intro-text">Sua conta foi criada com sucesso! Aqui estão suas informações de acesso à plataforma da Testing Company.</p>
          
          <div class="cred-box">
            <div class="cred-box-title">🔐 Suas Credenciais</div>
            <div class="cred-row">
              <span class="cred-label">Login:</span>
              <span class="cred-value">${login}</span>
            </div>
            <div class="cred-row">
              <span class="cred-label">Senha:</span>
              <span class="cred-value">${tempPassword}</span>
            </div>
          </div>
          
          <center>
            <a href="${loginUrl}" class="button" style="background:#ef0001;color:#ffffff !important;display:inline-block;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Acessar a Plataforma</a>
          </center>
          
          <p style="text-align: center; color: #6b7280; font-size: 13px; margin-top: 12px;">
            Link direto: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${loginUrl}</code>
          </p>
          
          <div class="divider"></div>
          
          <div class="steps">
            <p style="font-weight: 600; margin: 0 0 12px; color: #1f2937;">📋 Próximos passos:</p>
            <div class="step" data-step="1">Acesse a plataforma com suas credenciais</div>
            <div class="step" data-step="2">Navegue até <strong>Meu Perfil</strong></div>
            <div class="step" data-step="3">Clique em <strong>Alterar Senha</strong> e defina uma nova senha segura</div>
            <div class="step" data-step="4">Comece a usar a plataforma!</div>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Importante:</strong> Esta senha é temporária. Troque-a imediatamente após seu primeiro acesso. Não compartilhe estas credenciais com outras pessoas.
          </div>
        </div>
        <div class="footer">
          <p style="margin: 0;">Este é um email automático. Por favor, não responda.</p>
          <p style="margin: 4px 0 0;">&copy; 2026 Testing Company - Quality Control. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  </body>
</html>
  `;
}

async function sendTestEmail() {
  log(colors.bright + colors.blue, '\n🚀 ENVIANDO EMAIL DE TESTE\n');

  const testEmail = 'paulalysyk123@gmail.com';
  const fullName = 'Paula Lysyk';
  const login = 'paula.lysyk';
  const tempPassword = generateTempPassword();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quality-control-qwqs.onrender.com';
  const loginUrl = `${baseUrl.replace(/\/+$/, '')}/login`;

  log(colors.cyan, 'Dados do Email:');
  log(colors.white, `  Para: ${testEmail}`);
  log(colors.white, `  Nome: ${fullName}`);
  log(colors.white, `  Login: ${login}`);
  log(colors.white, `  Senha: ${tempPassword}`);

  try {
    log(colors.yellow, '\n📧 Conectando ao SMTP...\n');

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT || 587),
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
      },
    });

    // Verificar conexão
    await transporter.verify();
    log(colors.green, '✅ Conexão SMTP verificada');

    // Gerar email HTML
    const emailHtml = generateWelcomeEmailHtml(fullName, login, tempPassword);

    // Enviar email
    log(colors.yellow, '\n📤 Enviando email...\n');

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: testEmail,
      subject: 'Seus dados de acesso - Quality Control',
      html: emailHtml,
      text: `
Bem-vindo ao Quality Control!

Seus dados de acesso:
Login: ${login}
Senha: ${tempPassword}

Acesse: ${loginUrl}

Importante: Troque sua senha após o primeiro acesso em Meu Perfil > Alterar Senha.

Atenciosamente,
Equipe Testing Company
      `.trim(),
    });

    log(colors.bright + colors.green, '✅ EMAIL ENVIADO COM SUCESSO!\n');
    log(colors.white, `  MessageId: ${info.messageId}`);
    log(colors.white, `  Response: ${info.response}`);

    log(colors.bright + colors.cyan, '\n' + '═'.repeat(70));
    log(colors.bright + colors.yellow, '\n📧 Email foi enviado para: paulalysyk123@gmail.com\n');
    log(colors.white, '  • Verifique a caixa de entrada (ou spam)');
    log(colors.white, '  • Procure por "Seus dados de acesso - Quality Control"');
    log(colors.white, '  • Login: paula.lysyk');
    log(colors.white, `  • Senha: ${tempPassword}\n`);

  } catch (err) {
    log(colors.red, `\n❌ ERRO AO ENVIAR EMAIL: ${err.message}\n`);
    process.exit(1);
  }
}

sendTestEmail().catch(err => {
  log(colors.red, `\n❌ Erro fatal: ${err.message}`);
  process.exit(1);
});
