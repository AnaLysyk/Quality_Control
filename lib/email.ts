import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private smtpWarningShown = false;

  private resolveSmtpConfig() {
    const host = (process.env.EMAIL_SMTP_HOST || '').trim();
    const user = (process.env.EMAIL_SMTP_USER || '').trim();
    const pass = (process.env.EMAIL_SMTP_PASS || '').trim();
    if (!host || !user || !pass) return null;

    const isLocalHost = ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host.toLowerCase());
    if (process.env.NODE_ENV === 'production' && isLocalHost) {
      return null;
    }

    const port = this.resolvePort();
    const secureEnv = String(process.env.EMAIL_SMTP_SECURE || '').toLowerCase();
    const secure = secureEnv ? secureEnv === 'true' : port === 465;

    return { host, port, secure, user, pass };
  }

  private resolvePort() {
    const parsed = Number.parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
    return Number.isFinite(parsed) ? parsed : 587;
  }

  private getTransporter() {
    const config = this.resolveSmtpConfig();
    if (!config) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    }
    return this.transporter;
  }

  private resolvePublicBaseUrl() {
    const raw =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.APP_URL ||
      "https://quality-control-qwqs.onrender.com";
    return raw.replace(/\/+$/, "");
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Evita chamadas de rede em ambientes de dev/teste (a menos que FORCE_EMAIL_SEND=true).
      const forceEmail = String(process.env.FORCE_EMAIL_SEND || '').toLowerCase() === 'true';
      if (!forceEmail && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
        console.log('[DEV MODE] Email simulado (defina FORCE_EMAIL_SEND=true para enviar de verdade):');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        return true;
      }

      const transporter = this.getTransporter();
      if (!transporter) {
        if (!this.smtpWarningShown) {
          console.error('[EMAIL] SMTP nao configurado para producao. Defina EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS e EMAIL_FROM.');
          this.smtpWarningShown = true;
        }
        return false;
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@quality-control.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Email enviado com sucesso:', result.messageId);
      return true;
    } catch (error) {
      console.error('Falha ao enviar email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${this.resolvePublicBaseUrl()}/login/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Redefinir Senha - Quality Control</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f8f9fa; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Quality Control</h1>
              <p>Redefinicao de senha</p>
            </div>
            <div class="content">
              <h2>Ola!</h2>
              <p>Recebemos uma solicitacao para redefinir sua senha. Clique no botao abaixo para criar uma nova senha:</p>

              <a href="${resetUrl}" class="button">Redefinir Senha</a>

              <p><strong>Link direto:</strong> ${resetUrl}</p>

              <p><em>Este link e valido por 15 minutos.</em></p>

              <p>Se voce nao solicitou esta redefinicao, ignore este email. Sua senha permanecera a mesma.</p>
            </div>
            <div class="footer">
              <p>Este e um email automatico. Por favor, nao responda.</p>
              <p>&copy; 2026 Quality Control. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Quality Control - Redefinicao de senha

      Ola!

      Recebemos uma solicitacao para redefinir sua senha.

      Clique no link abaixo para criar uma nova senha:
      ${resetUrl}

      Este link e valido por 15 minutos.

      Se voce nao solicitou esta redefinicao, ignore este email.

      Atenciosamente,
      Equipe Quality Control
    `;

    return this.sendEmail({
      to: email,
      subject: 'Redefinir Senha - Quality Control',
      html,
      text,
    });
  }

  async sendWelcomeEmail(
    to: string,
    login: string,
    tempPassword: string,
    fullName?: string | null,
  ): Promise<boolean> {
    const loginUrl = `${this.resolvePublicBaseUrl()}/login`;
    const greeting = fullName ? `Olá, ${fullName}!` : 'Olá!';

    // Design System - Testing Company
    const colors = {
      primary: '#011848',      // Login Navy
      primaryDark: '#02307a',  // Login Dark Navy
      secondary: '#ef0001',    // Login Red
      success: '#10b981',      // Green
      warning: '#f59e0b',      // Amber
      danger: '#ef4444',       // Red
      neutral50: '#f9fafb',    // Very Light Gray
      neutral100: '#f4f6fb',   // Login Background Light
      neutral200: '#d8dfeb',   // Login Border
      neutral400: '#5f77a2',   // Login Muted
      neutral600: '#27457d',   // Login Body Text
      neutral900: '#081f4d',   // Login Heading
      white: '#ffffff',
    };

    const typography = {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      fontSize: {
        xs: '12px',
        sm: '13px',
        base: '14px',
        lg: '15px',
        xl: '18px',
        '2xl': '24px',
      },
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
    };

    const spacing = {
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '32px',
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Bem-vindo ao Testing Company - Quality Control</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: ${typography.fontFamily};
              line-height: 1.6;
              color: ${colors.neutral600};
              background: ${colors.neutral100};
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: ${spacing.lg};
            }
            .email-body {
              background: ${colors.white};
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
              color: ${colors.white};
              padding: ${spacing['3xl']} ${spacing['2xl']};
              text-align: center;
              border-bottom: 4px solid ${colors.secondary};
            }
            .header-logo {
              font-size: ${typography.fontSize['2xl']};
              font-weight: ${typography.fontWeight.bold};
              margin-bottom: ${spacing.md};
              letter-spacing: -0.5px;
            }
            .header-subtitle {
              font-size: ${typography.fontSize.sm};
              opacity: 0.95;
              font-weight: ${typography.fontWeight.medium};
              letter-spacing: 0.5px;
            }
            .content {
              padding: ${spacing['3xl']} ${spacing['2xl']};
            }
            .greeting {
              font-size: ${typography.fontSize.xl};
              font-weight: ${typography.fontWeight.semibold};
              margin-bottom: ${spacing.lg};
              color: ${colors.neutral900};
            }
            .intro-text {
              color: ${colors.neutral600};
              margin-bottom: ${spacing.xl};
              font-size: ${typography.fontSize.base};
              line-height: 1.8;
            }
            .section-title {
              font-size: ${typography.fontSize.sm};
              font-weight: ${typography.fontWeight.bold};
              color: ${colors.neutral400};
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: ${spacing.lg};
              margin-top: ${spacing['2xl']};
            }
            .cred-box {
              background: linear-gradient(135deg, ${colors.neutral50} 0%, ${colors.white} 100%);
              border: 2px solid ${colors.neutral200};
              border-radius: 8px;
              padding: ${spacing.xl};
              margin: ${spacing.xl} 0;
              font-family: 'Monaco', 'Courier New', monospace;
            }
            .cred-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: ${spacing.md} 0;
              border-bottom: 1px solid ${colors.neutral200};
            }
            .cred-row:last-child {
              border-bottom: none;
            }
            .cred-label {
              color: ${colors.neutral400};
              font-size: ${typography.fontSize.sm};
              font-weight: ${typography.fontWeight.medium};
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .cred-value {
              color: ${colors.primary};
              font-weight: ${typography.fontWeight.bold};
              font-size: ${typography.fontSize.base};
              letter-spacing: 0.3px;
            }
            .button {
              display: inline-block;
              padding: ${spacing.md} ${spacing.xl};
              background: ${colors.secondary};
              color: ${colors.white};
              text-decoration: none;
              border-radius: 8px;
              font-size: ${typography.fontSize.lg};
              font-weight: ${typography.fontWeight.semibold};
              margin: ${spacing.xl} 0;
              border: none;
              cursor: pointer;
              transition: all 0.3s ease;
              text-align: center;
              box-shadow: 0 2px 8px rgba(239, 0, 1, 0.28);
            }
            .button:hover {
              background: #c70000;
              color: ${colors.white};
            }
            .button-center {
              text-align: center;
            }
            .link-direct {
              text-align: center;
              color: ${colors.neutral400};
              font-size: ${typography.fontSize.sm};
              margin-top: ${spacing.lg};
            }
            .link-direct code {
              background: ${colors.neutral50};
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Monaco', 'Courier New', monospace;
              color: ${colors.primary};
              font-weight: ${typography.fontWeight.semibold};
            }
            .steps {
              margin: ${spacing.xl} 0;
            }
            .steps-title {
              font-weight: ${typography.fontWeight.semibold};
              margin-bottom: ${spacing.lg};
              color: ${colors.neutral900};
              font-size: ${typography.fontSize.base};
            }
            .step {
              display: flex;
              gap: ${spacing.lg};
              margin: ${spacing.md} 0;
              padding: ${spacing.md} 0;
              align-items: flex-start;
            }
            .step-number {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              min-width: 28px;
              background: ${colors.primary};
              color: ${colors.white};
              border-radius: 50%;
              font-size: ${typography.fontSize.sm};
              font-weight: ${typography.fontWeight.bold};
            }
            .step-text {
              color: ${colors.neutral600};
              font-size: ${typography.fontSize.sm};
              padding-top: 2px;
            }
            .divider {
              height: 1px;
              background: ${colors.neutral200};
              margin: ${spacing.xl} 0;
            }
            .warning-box {
              background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
              border-left: 4px solid ${colors.warning};
              padding: ${spacing.lg};
              margin: ${spacing.xl} 0;
              border-radius: 4px;
              font-size: ${typography.fontSize.sm};
            }
            .warning-box strong {
              color: #b45309;
              display: block;
              margin-bottom: ${spacing.sm};
            }
            .footer {
              background: ${colors.neutral50};
              padding: ${spacing.xl} ${spacing['2xl']};
              text-align: center;
              border-top: 1px solid ${colors.neutral200};
              font-size: ${typography.fontSize.xs};
              color: ${colors.neutral400};
            }
            .footer p {
              margin: ${spacing.sm} 0;
            }
            .badge {
              display: inline-block;
              background: ${colors.secondary};
              color: ${colors.white};
              padding: 2px 8px;
              border-radius: 4px;
              font-size: ${typography.fontSize.xs};
              font-weight: ${typography.fontWeight.semibold};
              margin-right: ${spacing.sm};
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="email-body">
              <!-- HEADER -->
              <div class="header">
                <div class="header-logo">🏢 Testing Company</div>
                <div class="header-subtitle">Quality Control • Bem-vindo à plataforma</div>
              </div>

              <!-- CONTENT -->
              <div class="content">
                <p class="greeting">${greeting}</p>
                <p class="intro-text">
                  Sua conta foi criada com sucesso! Você agora tem acesso à plataforma 
                  <strong>Quality Control da Testing Company</strong>.
                </p>

                <!-- CREDENTIALS SECTION -->
                <div class="section-title">🔐 Suas Credenciais de Acesso</div>
                <div class="cred-box">
                  <div class="cred-row">
                    <span class="cred-label">Login</span>
                    <span class="cred-value">${login}</span>
                  </div>
                  <div class="cred-row">
                    <span class="cred-label">Senha</span>
                    <span class="cred-value">${tempPassword}</span>
                  </div>
                </div>

                <!-- CTA BUTTON -->
                <div class="button-center">
                  <a href="${loginUrl}" class="button" style="color:#ffffff !important;background:${colors.secondary};display:inline-block;padding:${spacing.md} ${spacing.xl};border-radius:8px;text-decoration:none;font-weight:${typography.fontWeight.semibold};">🚀 Acessar a Plataforma</a>
                </div>
                <div class="link-direct">
                  Link: <code>${loginUrl}</code>
                </div>

                <div class="divider"></div>

                <!-- NEXT STEPS -->
                <div class="steps">
                  <p class="steps-title">📋 Seus Próximos Passos:</p>
                  <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-text">Acesse a plataforma com suas credenciais</div>
                  </div>
                  <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-text">Navegue até <strong>Meu Perfil</strong></div>
                  </div>
                  <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-text">Clique em <strong>Alterar Senha</strong> e defina uma nova senha segura</div>
                  </div>
                  <div class="step">
                    <div class="step-number">4</div>
                    <div class="step-text">Comece a usar a plataforma!</div>
                  </div>
                </div>

                <!-- WARNING -->
                <div class="warning-box">
                  <strong>⚠️ Importante:</strong>
                  Esta senha é <strong>temporária</strong>. Troque-a imediatamente após seu primeiro acesso. 
                  Não compartilhe estas credenciais com outras pessoas.
                </div>
              </div>

              <!-- FOOTER -->
              <div class="footer">
                <p><strong>Testing Company</strong> • Quality Control Platform</p>
                <p>Este é um email automático. Por favor, não responda.</p>
                <p>&copy; 2026 Testing Company. Todos os direitos reservados.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Quality Control - Seus dados de acesso

${greeting}

Sua conta foi criada. Use as credenciais abaixo para acessar a plataforma:

Login: ${login}
Senha: ${tempPassword}

Acesse em: ${loginUrl}

IMPORTANTE: Troque sua senha após o primeiro acesso em Meu Perfil > Alterar Senha.
Não compartilhe estas credenciais.

Atenciosamente,
Equipe Testing Company
    `.trim();

    return this.sendEmail({
      to,
      subject: 'Seus dados de acesso - Quality Control',
      html,
      text,
    });
  }

  async sendAccessApprovedEmail(
    to: string,
    data: {
      name?: string | null;
      login: string;
      tempPassword: string;
      profileType?: string | null;
      companySlug?: string | null;
    },
  ): Promise<boolean> {
    const loginUrl = `${this.resolvePublicBaseUrl()}/login`;
    const greeting = data.name ? `Olá, ${data.name}!` : 'Olá!';
    const profileLabel = data.profileType ? ` (${data.profileType})` : '';
    const companyLine = data.companySlug ? `<p><strong>Empresa:</strong> ${data.companySlug}</p>` : '';
    const companyText = data.companySlug ? `Empresa: ${data.companySlug}\n` : '';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Acesso Aprovado - Quality Control</title>
<style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;background:#f4f6fb}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .hdr{background:#011848;color:#fff;padding:28px 32px;text-align:center}
  .hdr h1{margin:0;font-size:22px}
  .body{padding:32px}
  .badge{display:inline-block;background:#10b981;color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;margin-bottom:16px}
  .cred{background:#f0f4ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:4px;margin:20px 0}
  .cred p{margin:6px 0;font-family:monospace}
  .btn{display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-top:16px}
  .footer{text-align:center;padding:20px;font-size:12px;color:#888}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr"><h1>Quality Control</h1><p style="margin:4px 0;opacity:.8">Solicitação de acesso aprovada</p></div>
  <div class="body">
    <span class="badge">✓ Acesso aprovado</span>
    <h2 style="margin-top:0">${greeting}</h2>
    <p>Sua solicitação de acesso foi <strong>aprovada</strong>. Aqui estão suas credenciais de acesso:</p>
    <div class="cred">
      <p><strong>Login:</strong> ${data.login}</p>
      <p><strong>Senha temporária:</strong> ${data.tempPassword}</p>
      ${companyLine}
      <p><strong>Perfil:</strong>${profileLabel || ' padrão'}</p>
    </div>
    <p>Acesse o sistema clicando no botão abaixo:</p>
    <a href="${loginUrl}" class="btn">Acessar o sistema</a>
    <p style="margin-top:24px;font-size:13px;color:#666"><em>Por segurança, recomendamos trocar sua senha após o primeiro acesso em <strong>Meu Perfil → Alterar Senha</strong>. Não compartilhe suas credenciais.</em></p>
  </div>
  <div class="footer"><p>E-mail automático. Não responda.</p><p>© ${new Date().getFullYear()} Quality Control.</p></div>
</div>
</body>
</html>`;

    const text = `${greeting}\n\nSua solicitação de acesso foi aprovada!\n\nCredenciais de acesso:\nLogin: ${data.login}\nSenha temporária: ${data.tempPassword}\n${companyText}Perfil:${profileLabel || ' padrão'}\n\nAcesse em: ${loginUrl}\n\nTroque sua senha após o primeiro acesso.`;

    return this.sendEmail({
      to,
      subject: 'Acesso aprovado - Quality Control',
      html,
      text,
    });
  }

  async sendAccessRejectedEmail(
    to: string,
    data: {
      name?: string | null;
      comment?: string | null;
      accessKey?: string | null;
    },
  ): Promise<boolean> {
    const greeting = data.name ? `Olá, ${data.name}!` : 'Olá!';
    const commentBlock = data.comment
      ? `<div style="background:#fff4f4;border-left:4px solid #ef4444;padding:14px 18px;border-radius:4px;margin:16px 0"><p style="margin:0;color:#444"><strong>Motivo:</strong> ${data.comment}</p></div>`
      : '';
    const commentText = data.comment ? `\nMotivo informado:\n${data.comment}\n` : '';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Acesso Rejeitado - Quality Control</title>
<style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;background:#f4f6fb}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .hdr{background:#011848;color:#fff;padding:28px 32px;text-align:center}
  .hdr h1{margin:0;font-size:22px}
  .body{padding:32px}
  .badge{display:inline-block;background:#ef4444;color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;margin-bottom:16px}
  .footer{text-align:center;padding:20px;font-size:12px;color:#888}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr"><h1>Quality Control</h1></div>
  <div class="body">
    <span class="badge">✕ Solicitação rejeitada</span>
    <h2 style="margin-top:0">${greeting}</h2>
    <p>Infelizmente sua solicitação de acesso foi <strong>rejeitada</strong>.</p>
    ${commentBlock}
    <p>Se tiver dúvidas, entre em contato com a equipe de suporte.</p>
  </div>
  <div class="footer"><p>E-mail automático. Não responda.</p><p>© ${new Date().getFullYear()} Quality Control.</p></div>
</div>
</body>
</html>`;

    const text = `${greeting}\n\nSua solicitação de acesso foi rejeitada.${commentText}\n\nPara dúvidas, entre em contato com o suporte.`;

    return this.sendEmail({
      to,
      subject: 'Solicitação de acesso rejeitada - Quality Control',
      html,
      text,
    });
  }

  async sendAccessAdjustmentEmail(
    to: string,
    data: {
      name?: string | null;
      adjustmentFields?: string[];
      comment?: string | null;
      accessKey: string;
    },
  ): Promise<boolean> {
    const baseUrl = this.resolvePublicBaseUrl();
    const statusUrl = `${baseUrl}/login/access-request/status?key=${data.accessKey}`;
    const greeting = data.name ? `Olá, ${data.name}!` : 'Olá!';

    const fieldsHtml = data.adjustmentFields && data.adjustmentFields.length > 0
      ? `<ul style="margin:8px 0 16px;padding-left:20px">${data.adjustmentFields.map((f) => `<li>${f}</li>`).join('')}</ul>`
      : '';
    const fieldsText = data.adjustmentFields && data.adjustmentFields.length > 0
      ? `\nCampos que precisam de ajuste:\n${data.adjustmentFields.map((f) => `- ${f}`).join('\n')}\n`
      : '';

    const commentBlock = data.comment
      ? `<div style="background:#fffbea;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:4px;margin:16px 0"><p style="margin:0;color:#444"><strong>Observação do revisor:</strong> ${data.comment}</p></div>`
      : '';
    const commentText = data.comment ? `\nObservação do revisor:\n${data.comment}\n` : '';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Ajuste necessário - Quality Control</title>
<style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;background:#f4f6fb}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .hdr{background:#011848;color:#fff;padding:28px 32px;text-align:center}
  .hdr h1{margin:0;font-size:22px}
  .body{padding:32px}
  .badge{display:inline-block;background:#f59e0b;color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;margin-bottom:16px}
  .key{font-family:monospace;background:#f0f4ff;padding:8px 14px;border-radius:4px;font-size:14px;display:inline-block;margin:8px 0}
  .btn{display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-top:16px}
  .footer{text-align:center;padding:20px;font-size:12px;color:#888}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr"><h1>Quality Control</h1><p style="margin:4px 0;opacity:.8">Ajuste necessário na solicitação</p></div>
  <div class="body">
    <span class="badge">⚠ Ajuste necessário</span>
    <h2 style="margin-top:0">${greeting}</h2>
    <p>Sua solicitação de acesso precisa de <strong>ajustes</strong> antes de ser aprovada.</p>
    ${fieldsHtml ? `<p><strong>Campos que precisam de revisão:</strong></p>${fieldsHtml}` : ''}
    ${commentBlock}
    <p>Use o link abaixo para acessar e corrigir sua solicitação:</p>
    <p class="key">Chave de acesso: <strong>${data.accessKey}</strong></p>
    <a href="${statusUrl}" class="btn">Abrir minha solicitação</a>
    <p style="margin-top:24px;font-size:12px;color:#888">Ou copie o link: ${statusUrl}</p>
  </div>
  <div class="footer"><p>E-mail automático. Não responda.</p><p>© ${new Date().getFullYear()} Quality Control.</p></div>
</div>
</body>
</html>`;

    const text = `${greeting}\n\nSua solicitação de acesso precisa de ajustes.${fieldsText}${commentText}\nAcesse sua solicitação em:\n${statusUrl}\n\nChave de acesso: ${data.accessKey}`;

    return this.sendEmail({
      to,
      subject: 'Ajuste necessário na sua solicitação - Quality Control',
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
