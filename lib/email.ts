import nodemailer from 'nodemailer';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

  private resolveEmailLogoUrl() {
    const configured =
      process.env.EMAIL_LOGO_URL ||
      process.env.NEXT_PUBLIC_EMAIL_LOGO_URL ||
      "";
    if (configured.trim()) return configured.trim();

    return `${this.resolvePublicBaseUrl()}/images/tc.png`;
  }


  private resolveEmailLogoSrc() {
    const configured =
      process.env.EMAIL_LOGO_URL ||
      process.env.NEXT_PUBLIC_EMAIL_LOGO_URL ||
      "";

    if (configured.trim()) return configured.trim();

    if (process.env.NODE_ENV !== "production") {
      const localLogoPath = join(process.cwd(), "public", "images", "tc.png");

      try {
        if (existsSync(localLogoPath)) {
          const base64Logo = readFileSync(localLogoPath).toString("base64");
          return `data:image/png;base64,${base64Logo}`;
        }
      } catch {
        // Fallback para URL pública caso não consiga ler o arquivo local.
      }
    }

    return this.resolveEmailLogoUrl();
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const captureEnabled =
        String(process.env.EMAIL_CAPTURE_MODE || "").toLowerCase() === "file" ||
        String(process.env.ACCESS_REQUEST_EMAIL_BYPASS || "").toLowerCase() === "true";
      if (captureEnabled && process.env.NODE_ENV !== "production") {
        const captureFile = process.env.EMAIL_CAPTURE_FILE || "test-results/emails/outbox.jsonl";
        mkdirSync(dirname(captureFile), { recursive: true });
        appendFileSync(
          captureFile,
          JSON.stringify({
            at: new Date().toISOString(),
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text ?? null,
          }) + "\n",
          "utf8",
        );
        return true;
      }

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
    const safeResetUrl = escapeHtml(resetUrl);
    const logoUrl = escapeHtml(this.resolveEmailLogoSrc());

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redefinir senha - Quality Control</title>
</head>
<body style="width:100%!important;margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#011848;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6fb" style="width:100%;border-collapse:collapse;background-color:#f4f6fb;">
    <tr>
      <td align="center" style="padding:20px 8px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;border:1px solid #d8dfeb;border-collapse:separate;border-spacing:0;background-color:#ffffff;border-radius:18px;overflow:hidden;">
          <tr>
            <td align="center" bgcolor="#011848" style="padding:14px 20px;background-color:#011848;border-top:4px solid #ef0001;color:#ffffff;text-align:center;">
              <img src="${logoUrl}" alt="" width="48" style="display:block;width:48px;max-width:48px;height:auto;margin:0 auto 5px;border:0;outline:none;text-decoration:none;">
              <div style="color:#ffffff;font-size:22px;font-weight:900;line-height:26px;">Quality Control</div>
              <div style="margin-top:3px;color:#ffffff;font-size:12px;line-height:16px;">Segurança da sua conta</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 28px;color:#011848;font-family:Arial,Helvetica,sans-serif;">
              <div style="display:inline-block;margin-bottom:12px;padding:6px 11px;border:1px solid #bfdbfe;border-radius:999px;background-color:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:900;">Redefinição de senha</div>
              <h1 style="margin:0 0 10px;color:#011848;font-size:22px;line-height:28px;">Crie uma nova senha</h1>
              <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">Recebemos uma solicitação para redefinir a senha da sua conta no Quality Control.</p>
              <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:22px;">Use o botão abaixo para escolher uma nova senha. O link é individual e válido por 15 minutos.</p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto;border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="#ef0001" style="background-color:#ef0001;border-radius:9px;mso-padding-alt:11px 22px;">
                    <a href="${safeResetUrl}" style="display:inline-block;padding:11px 22px;color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;line-height:18px;text-align:center;text-decoration:none;">Redefinir senha</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f0f4ff" style="width:100%;margin:18px 0;border:1px solid #d8dfeb;border-collapse:separate;border-left:5px solid #011848;border-radius:12px;background-color:#f0f4ff;">
                <tr>
                  <td style="padding:13px 15px;color:#27457d;font-size:13px;line-height:20px;">Se você não solicitou esta alteração, ignore este e-mail. Sua senha atual continuará válida.</td>
                </tr>
              </table>

              <p style="margin:0;color:#64748b;font-size:11px;line-height:17px;word-break:break-all;">Link direto: <a href="${safeResetUrl}" style="color:#27457d;text-decoration:underline;">${safeResetUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#ffffff" style="padding:16px 24px 20px;border-top:1px solid #e5eaf3;background-color:#ffffff;color:#64748b;font-size:12px;line-height:18px;text-align:center;">E-mail automático. Não responda.<br>© ${new Date().getFullYear()} Quality Control.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `Quality Control - Redefinição de senha

Recebemos uma solicitação para redefinir a senha da sua conta.

Crie uma nova senha pelo link:
${resetUrl}

Este link é individual e válido por 15 minutos.

Se você não solicitou esta alteração, ignore este e-mail. Sua senha atual continuará válida.

Equipe Quality Control`;

    return this.sendEmail({
      to: email,
      subject: 'Redefinir senha - Quality Control',
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
                <div class="header-logo"><img src="${this.resolveEmailLogoSrc()}" alt="" style="display:block;margin:0 auto 10px;max-width:90px;height:auto;border:0;" /></div>
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
                <p><strong></strong> • Quality Control Platform</p>
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

  async sendAccessRequestReceivedEmail(
    to: string,
    data: {
      name?: string | null;
      accessKey: string;
      email: string;
      username?: string | null;
      user?: string | null;
      phone?: string | null;
      passwordDefined?: boolean;
      profileType?: string | null;
      companyName?: string | null;
      title?: string | null;
      description?: string | null;
      status?: string | null;
      companyDetails?: Record<string, unknown> | null;
    },
  ): Promise<boolean> {
    const lookupUrl = `${this.resolvePublicBaseUrl()}/login/access-request/status?key=${encodeURIComponent(data.accessKey)}`;
    const accessUsername = (data.username ?? data.user ?? data.email ?? "").trim();
    const profileKey = String(data.profileType ?? "").trim();
    const companyName = String(data.companyName ?? "").trim();
    const isCompanyUser = profileKey === "company_user";
    const companyDisplayName = companyName ? companyName.toLocaleUpperCase("pt-BR") : "";
    const identityText =
      isCompanyUser && data.name && companyDisplayName
        ? `${data.name} / ${companyDisplayName}`
        : data.name ?? "";
    const greetingText = identityText ? `Olá, ${identityText}!` : "Olá!";
    const greeting =
      isCompanyUser && data.name && companyDisplayName
        ? `Olá, ${escapeHtml(data.name)} <span style="font-size:13px;font-weight:800;color:#64748b;">/ ${escapeHtml(companyDisplayName)}</span>!`
        : data.name
          ? `Olá, ${escapeHtml(data.name)}!`
          : "Olá!";
    const profileLabels: Record<string, string> = {
      empresa: "Empresa",
      company_user: companyName ? `Acesso vinculado à ${companyName}` : "Acesso vinculado à empresa",
      testing_company_user: "Usuário Testing Company",
      leader_tc: "Líder TC",
      technical_support: "Suporte técnico",
      company_access: "Empresa",
    };

    const profileLabel = profileLabels[profileKey] ?? (profileKey ? profileKey.replaceAll("_", " ") : "Perfil solicitado");

    const formatValue = (value: unknown) => {
      if (value === null || value === undefined || value === "") return "";
      if (Array.isArray(value)) return value.filter(Boolean).join(", ");
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    };

    const labelMap: Record<string, string> = {
      companyName: "Razão social",
      fantasyName: "Nome fantasia",
      cnpj: "CNPJ",
      companyTaxId: "CNPJ duplicado",
      cep: "CEP",
      address: "Endereço",
      number: "Número",
      complement: "Complemento",
      district: "Bairro",
      city: "Cidade",
      state: "Estado",
      phone: "Telefone da empresa",
      email: "E-mail da empresa",
      website: "Website",
      site: "Website",
      linkedin: "LinkedIn",
      linkedIn: "LinkedIn",
      situation: "Situação cadastral",
      openingDate: "Data de abertura",
      legalNature: "Natureza jurídica",
      mainActivity: "Atividade principal",
      size: "Porte",
      shareCapital: "Capital social",
    };

    const hiddenKeys = new Set(["password", "senha", "plainPassword", "confirmPassword", "captcha", "token", "accessKey"]);

    const hasCnpj = Boolean(formatValue((data.companyDetails ?? {}).cnpj));

    const companyRows = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => {
        if (hiddenKeys.has(key)) return false;
        if (hasCnpj && (key === "companyTaxId" || key === "company_tax_id")) return false;
        return Boolean(formatValue(value));
      })
      .map(([key, value]) => {
        const label = labelMap[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
        return `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(formatValue(value))}</td></tr>`;
      })
      .join("");

    const companyUserSection = isCompanyUser && companyName
      ? `<div class="section-title">Vínculo empresarial</div><div class="info"><table><tr><td class="label">Pessoa / empresa</td><td class="value">${escapeHtml(data.name ?? "-")} <span style="font-size:11px;color:#64748b;">/ ${escapeHtml(companyDisplayName)}</span></td></tr><tr><td class="label">Empresa vinculada</td><td class="value">${escapeHtml(companyName)}</td></tr></table></div>`
      : "";

    const companySection = companyRows
      ? `<div class="section-title">Dados da empresa</div><div class="info"><table>${companyRows}</table></div>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Solicitação de acesso recebida - Quality Control</title>
  <style>
    body{width:100%!important;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table{border-spacing:0}
    .card{width:600px;max-width:600px;margin:0 auto;background:#fff;border:1px solid rgba(1,24,72,.12);border-radius:20px;overflow:hidden;box-shadow:0 18px 46px rgba(1,24,72,.20)}
    .header{background-color:#011848;background-image:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);color:#fff;padding:10px 20px;text-align:center}
    .email-logo-spin{animation:emailLogoSpin 18s linear infinite}
    .header h1{margin:0;font-size:22px;line-height:1.15;letter-spacing:-.2px}
    .header p{margin:3px 0 0;font-size:12px;line-height:16px;opacity:.92}
    .content{padding:22px 28px 26px;word-wrap:break-word}
    .badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;font-size:12px;font-weight:900;margin-bottom:12px}
    h2{margin:0 0 10px;color:#011848;font-size:22px;line-height:1.3}
    p{margin:0 0 14px;color:#475569;font-size:14px;line-height:1.65}
    .section-title{margin:20px 0 8px;color:#011848;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.6px}
    .info{margin:0 0 16px;border:1px solid #d8dfeb;border-radius:14px;overflow:hidden;background:#f8fafc}
    .info table{width:100%;border-collapse:collapse;table-layout:fixed}
    .info td{padding:11px 14px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:900}
    .value{color:#011848;font-weight:900;word-break:break-word;overflow-wrap:anywhere}
    .box{margin:18px 0;padding:14px 16px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:12px;color:#27457d;font-size:13px;line-height:1.6}
    .footer{padding:16px 24px 20px;text-align:center;color:#64748b;font-size:12px;background:#fff}
    @keyframes emailLogoSpin{
      from{transform:rotate(0deg)}
      to{transform:rotate(360deg)}
    }
    @media (prefers-reduced-motion:reduce){
      .email-logo-spin{animation:none!important}
    }
    @media only screen and (max-width:620px){
      .card{width:100%!important}
      .content{padding:20px 16px 24px!important}
      .label,.value{display:block!important;width:auto!important}
      .label{padding-bottom:3px!important;border-bottom:0!important}
      .value{padding-top:0!important}
    }
  </style>
  <!--[if mso]>
  <style>
    .email-logo-spin{animation:none!important;transform:none!important}
  </style>
  <![endif]-->
</head>
<body style="width:100%!important;margin:0;padding:0;background-color:#f4f6fb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6fb" style="width:100%;border-collapse:collapse;background-color:#f4f6fb;background-image:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%);">
    <tr>
      <td align="center" style="padding:16px 8px;">
        <table role="presentation" class="card" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;border:1px solid #d8dfeb;border-collapse:separate;border-spacing:0;background-color:#ffffff;border-radius:20px;overflow:hidden;">
          <tr>
            <td class="header" align="center" bgcolor="#011848" style="padding:10px 20px;background-color:#011848;background-image:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);border-radius:20px 20px 0 0;color:#ffffff;text-align:center;">
              <img class="email-logo-spin" src="${escapeHtml(this.resolveEmailLogoSrc())}" alt="" width="48" style="display:block;width:48px;max-width:48px;height:auto;margin:0 auto 4px;border:0;outline:none;text-decoration:none;">
              <h1 style="margin:0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;line-height:25px;letter-spacing:-.2px;">Quality Control</h1>
              <p style="margin:3px 0 0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;">Solicitação de acesso recebida</p>
            </td>
          </tr>
          <tr>
            <td class="content" style="padding:22px 28px 26px;color:#011848;font-family:Arial,Helvetica,sans-serif;word-wrap:break-word;">
        <span class="badge">Em análise</span>
        <h2>${greeting}</h2>
        <p>Recebemos sua solicitação de acesso. Ela está em análise pela equipe responsável. Você receberá uma atualização quando for aprovada, recusada ou quando precisar de ajuste.</p>

        <div class="section-title">Dados de acesso cadastrados</div>
        <div class="info">
          <table>
            <tr><td class="label">Usuário</td><td class="value">${escapeHtml(accessUsername || data.email)}</td></tr>
            <tr><td class="label">Senha cadastrada</td><td class="value">${data.passwordDefined ? "Definida com segurança no formulário" : "Não definida"}</td></tr>
            <tr><td class="label">${isCompanyUser ? "Tipo de acesso" : "Perfil solicitado"}</td><td class="value">${escapeHtml(profileLabel)}</td></tr>
            <tr><td class="label">Código de consulta</td><td class="value">${escapeHtml(data.accessKey)}</td></tr>
          </table>
        </div>

        <div class="section-title">Dados do solicitante</div>
        <div class="info">
          <table>
            <tr><td class="label">${isCompanyUser ? "Pessoa / empresa" : "Nome"}</td><td class="value">${isCompanyUser && companyDisplayName ? `${escapeHtml(data.name ?? "-")} <span style="font-size:11px;color:#64748b;">/ ${escapeHtml(companyDisplayName)}</span>` : escapeHtml(data.name ?? "-")}</td></tr>
            <tr><td class="label">E-mail</td><td class="value">${escapeHtml(data.email)}</td></tr>
            <tr><td class="label">Telefone</td><td class="value">${escapeHtml(data.phone ?? "-")}</td></tr>
          </table>
        </div>

        <div class="section-title">Dados da solicitação</div>
        <div class="info">
          <table>
            <tr><td class="label">Título</td><td class="value">${escapeHtml(data.title ?? "-")}</td></tr>
            <tr><td class="label">Descrição</td><td class="value">${escapeHtml(data.description ?? "-")}</td></tr>
            <tr><td class="label">Status</td><td class="value">${escapeHtml(data.status ?? "Em análise")}</td></tr>
          </table>
        </div>

        ${companyUserSection}
        ${companySection}

        <div class="box">Guarde este código. O botão abaixo abre a consulta desta solicitação; se o prazo expirar, use “Reenviar código” na tela de consulta para receber uma nova chave válida.</div>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto 10px;border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="#ef0001" style="background-color:#ef0001;border-radius:9px;mso-padding-alt:11px 20px;">
                    <a href="${escapeHtml(lookupUrl)}" style="display:inline-block;padding:11px 20px;color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;line-height:18px;text-align:center;text-decoration:none;">Consultar solicitação</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;text-align:center;font-size:11px;line-height:17px;color:#64748b;word-break:break-all;">Acesse a consulta em: <a href="${escapeHtml(lookupUrl)}" style="color:#27457d;text-decoration:underline;">${escapeHtml(lookupUrl)}</a></p>
            </td>
          </tr>
          <tr>
            <td class="footer" align="center" bgcolor="#ffffff" style="padding:16px 24px 20px;border-top:1px solid #e5eaf3;background-color:#ffffff;color:#64748b;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;text-align:center;">E-mail automático. Não responda.<br>© ${new Date().getFullYear()} Quality Control.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const companyText = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => {
        if (hiddenKeys.has(key)) return false;
        if (hasCnpj && (key === "companyTaxId" || key === "company_tax_id")) return false;
        return Boolean(formatValue(value));
      })
      .map(([key, value]) => `${labelMap[key] ?? key}: ${formatValue(value)}`)
      .join("\n");

    const text = `${greetingText}

Recebemos sua solicitação de acesso.

DADOS DE ACESSO
Usuário: ${accessUsername || data.email}
Senha cadastrada: ${data.passwordDefined ? "Definida com segurança no formulário" : "Não definida"}
${isCompanyUser ? "Tipo de acesso" : "Perfil solicitado"}: ${profileLabel}
Código de consulta: ${data.accessKey}

DADOS DO SOLICITANTE
${isCompanyUser ? "Pessoa / empresa" : "Nome"}: ${identityText || "-"}
E-mail: ${data.email}
Telefone: ${data.phone ?? "-"}

DADOS DA SOLICITAÇÃO
Título: ${data.title ?? "-"}
Descrição: ${data.description ?? "-"}
Status: ${data.status ?? "Em análise"}

${isCompanyUser && companyName ? `EMPRESA VINCULADA
${companyName}
` : ""}
${companyText ? `DADOS DA EMPRESA
${companyText}
` : ""}

Para consultar o andamento, use o link abaixo. Se o prazo expirar, reenvie o código pela tela de consulta.

Acesse a consulta em:
${lookupUrl}

Guarde este código para acompanhar o andamento da sua solicitação.`;

    return this.sendEmail({
      to,
      subject: "Solicitação de acesso recebida - Quality Control",
      html,
      text,
    });
  }

  async sendAccessApprovedEmail(
    to: string,
    data: {
      name?: string | null;
      login: string;
      tempPassword?: string | null;
      passwordFromRequest?: boolean;
      profileType?: string | null;
      companySlug?: string | null;
      companyName?: string | null;
    },
  ): Promise<boolean> {
    const loginUrl = `${this.resolvePublicBaseUrl()}/login`;
    const greetingText = data.name ? `Olá, ${data.name}!` : "Olá!";
    const greeting = data.name ? `Olá, ${escapeHtml(data.name)}!` : "Olá!";
    const normalizedRole = String(data.profileType ?? "").trim().toLowerCase();

    const roleContent: Record<string, {
      label: string;
      subject: string;
      title: string;
      intro: string;
      accessContext: string;
      permissionsTitle: string;
      permissions: string[];
      nextSteps: string[];
      badge: string;
    }> = {
      empresa: {
        label: "Empresa",
        subject: "Solicitação de acesso empresarial aprovada",
        title: "Solicitação de acesso empresarial aprovada",
        intro: "O acesso empresarial foi aprovado na plataforma Quality Control.",
        accessContext: "Este acesso permite administrar os dados da empresa e acompanhar os recursos liberados conforme as permissões configuradas.",
        permissionsTitle: "Com este acesso, você pode:",
        permissions: [
          "Acessar a plataforma com o login informado",
          "Conferir os dados da empresa",
          "Gerenciar usuários vinculados quando permitido",
          "Acompanhar informações e solicitações da empresa",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira os dados empresariais",
          "Oriente os usuários vinculados sobre o acesso",
          "Altere sua senha após o primeiro acesso",
        ],
        badge: "Empresa aprovada",
      },
      company_user: {
        label: "Usuário da empresa",
        subject: "Solicitação de acesso como usuário da empresa aprovada",
        title: "Solicitação de acesso como usuário da empresa aprovada",
        intro: "Seu acesso como usuário da empresa foi aprovado na plataforma Quality Control.",
        accessContext: "Este perfil permite utilizar a plataforma conforme o vínculo empresarial e as permissões liberadas para seu usuário.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acessar a plataforma com vínculo empresarial",
          "Utilizar os recursos liberados para sua empresa",
          "Acompanhar informações conforme suas permissões",
          "Solicitar suporte quando necessário",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira seu vínculo empresarial",
          "Utilize apenas os recursos liberados para sua empresa",
          "Altere sua senha após o primeiro acesso",
        ],
        badge: "Usuário da empresa aprovado",
      },
      testing_company_user: {
        label: "Usuário TC",
        subject: "Solicitação de acesso como usuário TC aprovada",
        title: "Solicitação de acesso como usuário TC aprovada",
        intro: "Seu acesso como usuário TC foi aprovado na plataforma Quality Control.",
        accessContext: "Este perfil é voltado para usuários internos, conforme as permissões liberadas para sua função.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acessar os recursos internos liberados para seu perfil",
          "Atuar nos fluxos permitidos",
          "Acompanhar atividades e informações da plataforma",
          "Utilizar o ambiente conforme suas permissões",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confirme seus dados no perfil",
          "Utilize os recursos liberados para seu perfil",
          "Altere sua senha após o primeiro acesso",
        ],
        badge: "Usuário TC aprovado",
      },
      leader_tc: {
        label: "Líder TC",
        subject: "Solicitação de acesso como líder TC aprovada",
        title: "Solicitação de acesso como líder TC aprovada",
        intro: "Seu acesso como líder TC foi aprovado na plataforma Quality Control.",
        accessContext: "Este perfil possui permissões de acompanhamento e administração dos fluxos liberados para liderança.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acompanhar solicitações de acesso",
          "Aprovar, recusar ou solicitar ajustes quando permitido",
          "Gerenciar fluxos vinculados à operação",
          "Acessar recursos administrativos liberados para liderança",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira as solicitações pendentes",
          "Revise os fluxos liberados para liderança",
          "Altere sua senha após o primeiro acesso",
        ],
        badge: "Líder TC aprovado",
      },
      technical_support: {
        label: "Suporte técnico",
        subject: "Solicitação de acesso como suporte técnico aprovada",
        title: "Solicitação de acesso como suporte técnico aprovada",
        intro: "Seu acesso como suporte técnico foi aprovado na plataforma Quality Control.",
        accessContext: "Este perfil permite atuar nos fluxos operacionais e de suporte conforme as permissões liberadas.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acompanhar solicitações e atendimentos",
          "Apoiar usuários e empresas vinculadas",
          "Atuar em revisões permitidas para suporte técnico",
          "Utilizar recursos técnicos liberados para seu perfil",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira as filas e solicitações disponíveis",
          "Atue apenas nos fluxos liberados para suporte técnico",
          "Altere sua senha após o primeiro acesso",
        ],
        badge: "Suporte técnico aprovado",
      },
    };

    const contentByRole =
      roleContent[normalizedRole] ??
      {
        label: escapeHtml(data.profileType ?? "Perfil aprovado"),
        subject: "Acesso aprovado",
        title: "Solicitação de acesso aprovada",
        intro: "Sua solicitação foi aprovada na plataforma Quality Control.",
        accessContext: "Este acesso permite utilizar a plataforma conforme as permissões vinculadas ao seu perfil.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acessar a plataforma",
          "Utilizar os recursos disponíveis para seu perfil",
          "Acompanhar informações conforme suas permissões",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira seus dados",
          "Altere sua senha após o primeiro acesso",
        ],
        badge: "Acesso aprovado",
      };

    const linkedCompanyName = String(data.companyName ?? data.companySlug ?? "").trim();
    const linkedCompanyDisplayName = linkedCompanyName;
    const isCompanyUser = normalizedRole === "empresa" || normalizedRole === "company_user";
    const shouldShowCompanyLine =
      Boolean(linkedCompanyName) &&
      (normalizedRole === "empresa" || normalizedRole === "company_user");

    const approvedProfileLabel =
      isCompanyUser && linkedCompanyName
        ? `Acesso vinculado à ${linkedCompanyName}`
        : contentByRole.label;
    const approvedGreeting =
      isCompanyUser && data.name && linkedCompanyDisplayName
        ? `Olá, ${escapeHtml(data.name)} <span style="font-size:13px;font-weight:800;color:#64748b;">/ ${escapeHtml(linkedCompanyDisplayName)}</span>!`
        : greeting;
    const approvedGreetingText =
      isCompanyUser && data.name && linkedCompanyDisplayName
        ? `Olá, ${data.name} / ${linkedCompanyDisplayName}!`
        : greetingText;
    const companyLine = shouldShowCompanyLine
      ? `<tr><td class="label">Empresa vinculada</td><td class="value">${escapeHtml(linkedCompanyName)}</td></tr>`
      : "";
    const companyTextLine = shouldShowCompanyLine ? `Empresa vinculada: ${linkedCompanyName}` : "";
    const passwordLabel = data.tempPassword
      ? escapeHtml(data.tempPassword)
      : data.passwordFromRequest
        ? "Senha cadastrada no formulário de solicitação"
        : "Use a senha definida no cadastro";

    const permissionsHtml = contentByRole.permissions.map((item) => `<li>${item}</li>`).join("");
    const nextStepsHtml = contentByRole.nextSteps.map((item) => `<li>${item}</li>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${contentByRole.subject} - Quality Control</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb}
    .page{width:100%;padding:42px 12px;background:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%)}
    .card{max-width:780px;margin:0 auto;background:rgba(255,255,255,.98);border:1px solid rgba(1,24,72,.14);border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(1,24,72,.25)}
    .header{background:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);color:#fff;padding:24px 24px;text-align:center}
    .brand{display:inline-flex;align-items:center;justify-content:center;margin:0 auto 12px;width:74px;height:74px;border-radius:999px;background:#ffffff;padding:0;box-shadow:0 10px 24px rgba(0,0,0,.22);overflow:hidden;border:1px solid rgba(255,255,255,.85)}
    .header h1{margin:0;font-size:22px;line-height:1.15;letter-spacing:-.2px}
    .header p{margin:8px 0 0;font-size:13px;color:#ffffff;opacity:1;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.35)}
    .content{padding:42px 46px 36px}
    .badge{display:inline-block;padding:8px 14px;border-radius:999px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;font-size:13px;font-weight:800;margin-bottom:18px}
    h2{margin:0 0 12px;color:#011848;font-size:23px;line-height:1.3}
    p{margin:0 0 16px;color:#475569;font-size:14px;line-height:1.75}
    .info{margin:24px 0;border:1px solid #d8dfeb;border-radius:18px;overflow:hidden;background:#f8fafc}
    .info table{width:100%;border-collapse:collapse}
    .info td{padding:15px 18px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:800}
    .value{color:#011848;font-weight:800;word-break:break-word}
    .box{margin:22px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d;font-size:13px;line-height:1.65}
    .box strong{color:#011848}
    .list{margin:10px 0 0;padding-left:20px;color:#27457d}
    .list li{margin:7px 0}
    .buttonWrap{text-align:center;margin:32px 0 12px}
    .button{display:inline-block;padding:16px 38px;border-radius:14px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff!important;text-decoration:none;font-weight:900;font-size:15px;box-shadow:0 14px 28px rgba(239,0,1,.28)}
    .footer{padding:20px 28px 28px;text-align:center;color:#64748b;font-size:12px;background:#fff}
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="brand"><img src="${escapeHtml(this.resolveEmailLogoSrc())}" alt="" width="74" height="74" style="display:block;width:74px;height:74px;object-fit:cover;border-radius:999px;border:0;outline:none;text-decoration:none;" /></div>
        <h1>Quality Control</h1>
        <p style="color:#ffffff!important;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.35);">${contentByRole.title}</p>
      </div>

      <div class="content">
        <span class="badge">✓ ${contentByRole.badge}</span>

        <h2>${approvedGreeting}</h2>

        <p>${contentByRole.intro}</p>
        <p>${contentByRole.accessContext}</p>

        <div class="info">
          <table>
            <tr><td class="label">Login cadastrado</td><td class="value">${escapeHtml(data.login)}</td></tr>
            <tr><td class="label">Senha cadastrada</td><td class="value">${passwordLabel}</td></tr>
            <tr><td class="label">${isCompanyUser ? "Tipo de acesso" : "Perfil aprovado"}</td><td class="value">${escapeHtml(approvedProfileLabel)}</td></tr>
            ${companyLine}
          </table>
        </div>

        <div class="box">
          <strong>${contentByRole.permissionsTitle}</strong>
          <ul class="list">${permissionsHtml}</ul>
        </div>

        <div class="box">
          <strong>Próximos passos:</strong>
          <ul class="list">${nextStepsHtml}</ul>
        </div>

        <div class="box">
          A senha deste acesso é a senha cadastrada no formulário de solicitação e será tratada como temporária.
          Após o primeiro acesso, é necessário alterar a senha em
          <strong>Meu Perfil → Alterar Senha</strong>. A senha temporária ficará válida por 10 dias após a aprovação. Após esse prazo, utilize a opção <strong>“Esqueci minha senha”</strong> para recuperar o acesso.
        </div>

        <div class="buttonWrap">
          <a href="${escapeHtml(loginUrl)}" class="button">Acessar o sistema</a>
        </div>

        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">
          Link direto: ${escapeHtml(loginUrl)}
        </p>
      </div>

      <div class="footer">
        E-mail automático. Não responda.<br>
        © ${new Date().getFullYear()} Quality Control.
      </div>
    </div>
  </div>
</body>
</html>`;

    const permissionsText = contentByRole.permissions.map((item) => `- ${item}`).join("\n");
    const nextStepsText = contentByRole.nextSteps.map((item) => `- ${item}`).join("\n");

    const text = `${approvedGreetingText}

${contentByRole.title}

${contentByRole.intro}
${contentByRole.accessContext}

Login cadastrado: ${data.login}
Senha cadastrada: ${passwordLabel}
${isCompanyUser ? "Tipo de acesso" : "Perfil aprovado"}: ${approvedProfileLabel}
${companyTextLine}

${contentByRole.permissionsTitle}
${permissionsText}

Próximos passos:
${nextStepsText}

Acesse em: ${loginUrl}

Após o primeiro acesso, é necessário alterar a senha no seu perfil. A senha temporária ficará válida por 10 dias após a aprovação. Após esse prazo, utilize a opção “Esqueci minha senha” para recuperar o acesso.`;

    return this.sendEmail({
      to,
      subject: `${contentByRole.subject} - Quality Control`,
      html,
      text,
    });
  }

﻿  async sendAccessRejectedEmail(
    to: string,
    data: {
      name?: string | null;
      comment?: string | null;
      accessKey?: string | null;
    },
  ): Promise<boolean> {
    const statusUrl = data.accessKey
      ? `${this.resolvePublicBaseUrl()}/login/access-request/status?key=${data.accessKey}`
      : null;

    const greetingText = data.name ? `Olá, ${data.name}!` : "Olá!";
    const greeting = data.name ? `Olá, ${escapeHtml(data.name)}!` : "Olá!";
    const logoSrc = escapeHtml(this.resolveEmailLogoSrc());
    const comment = data.comment || "Recusado por dados incompatíveis.";

    const statusButton = statusUrl
      ? `<div class="buttonWrap"><a href="${escapeHtml(statusUrl)}" class="button">Consultar solicitação</a></div>
         <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">Link direto: ${escapeHtml(statusUrl)}</p>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Solicitação de acesso rejeitada - Quality Control</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb}
    .page{width:100%;padding:42px 12px;background:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%)}
    .card{max-width:780px;margin:0 auto;background:rgba(255,255,255,.98);border:1px solid rgba(1,24,72,.14);border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(1,24,72,.25)}
    .header{background:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);color:#fff;padding:24px 24px;text-align:center}
    .brand{display:inline-flex;align-items:center;justify-content:center;margin:0 auto 12px;width:74px;height:74px;border-radius:999px;background:#ffffff;padding:0;box-shadow:0 10px 24px rgba(0,0,0,.22);overflow:hidden;border:1px solid rgba(255,255,255,.85)}
    .header h1{margin:0;font-size:22px;line-height:1.15;letter-spacing:-.2px}
    .header p{margin:8px 0 0;font-size:13px;color:#ffffff;opacity:1;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.35)}
    .content{padding:42px 46px 36px}
    .badge{display:inline-block;padding:8px 14px;border-radius:999px;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;font-size:13px;font-weight:800;margin-bottom:18px}
    h2{margin:0 0 12px;color:#011848;font-size:23px;line-height:1.3}
    p{margin:0 0 16px;color:#475569;font-size:14px;line-height:1.75}
    .reasonBox{margin:24px 0;padding:18px 20px;background:#fff1f2;border:1px solid #fecdd3;border-left:5px solid #ef4444;border-radius:16px;color:#7f1d1d;font-size:14px;line-height:1.65}
    .reasonBox strong{color:#7f1d1d}
    .box{margin:22px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d;font-size:13px;line-height:1.65}
    .buttonWrap{text-align:center;margin:32px 0 12px}
    .button{display:inline-block;padding:16px 38px;border-radius:14px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff!important;text-decoration:none;font-weight:900;font-size:15px;box-shadow:0 14px 28px rgba(239,0,1,.28)}
    .footer{padding:20px 28px 28px;text-align:center;color:#64748b;font-size:12px;background:#fff}
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="brand">
          <img src="${logoSrc}" alt="" width="74" height="74" style="display:block;width:74px;height:74px;object-fit:cover;border-radius:999px;border:0;outline:none;text-decoration:none;" />
        </div>
        <h1>Quality Control</h1>
        <p style="color:#ffffff!important;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.35);">Solicitação de acesso rejeitada</p>
      </div>

      <div class="content">
        <span class="badge">✕ Solicitação rejeitada</span>

        <h2>${greeting}</h2>

        <p>Infelizmente sua solicitação de acesso foi <strong>rejeitada</strong>.</p>

        <div class="reasonBox">
          <strong>Motivo informado:</strong> ${escapeHtml(comment)}
        </div>

        ${statusButton}

        <div class="box">
          Se tiver dúvidas, entre em contato com a equipe de suporte.
        </div>
      </div>

      <div class="footer">
        E-mail automático. Não responda.<br>
        © ${new Date().getFullYear()} Quality Control.
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `${greetingText}

Sua solicitação de acesso foi rejeitada.

Motivo informado:
${comment}
${statusUrl ? `\nConsulte em: ${statusUrl}\n` : ""}
Para dúvidas, entre em contato com o suporte.`;

    return this.sendEmail({
      to,
      subject: "Solicitação de acesso rejeitada - Quality Control",
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
    const lookupUrl = `${this.resolvePublicBaseUrl()}/login/access-request`;
    const greetingText = data.name ? `Olá, ${data.name}!` : "Olá!";
    const greeting = data.name ? `Olá, ${escapeHtml(data.name)}!` : "Olá!";
    const ttlMinutesRaw =
      process.env.ACCESS_REQUEST_LOOKUP_CODE_TTL_MINUTES ||
      process.env.ACCESS_REQUEST_ACCESS_KEY_TTL_MINUTES ||
      "5";
    const ttlMinutes = Number.parseInt(ttlMinutesRaw, 10) > 0 ? Number.parseInt(ttlMinutesRaw, 10) : 5;
    const observation = (data.comment ?? "").trim() || "Revise sua solicitação pela tela de consulta.";
    const observationHtml = escapeHtml(observation).replaceAll("\n", "<br>");
    const safeLookupUrl = escapeHtml(lookupUrl);
    const safeAccessKey = escapeHtml(data.accessKey);
    const logoUrl = escapeHtml(this.resolveEmailLogoSrc());

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ajuste necessário na solicitação - Quality Control</title>
  <style>
    body{width:100%!important;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table{border-spacing:0}
    .card{width:600px;max-width:600px;margin:0 auto;background:#fff;border:1px solid rgba(1,24,72,.12);border-radius:20px;overflow:hidden;box-shadow:0 18px 46px rgba(1,24,72,.20)}
    .header{background-color:#011848;background-image:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);color:#fff;padding:10px 20px;text-align:center}
    .header h1{margin:0;font-size:22px;line-height:1.15;letter-spacing:-.2px}
    .header p{margin:3px 0 0;font-size:12px;line-height:16px;opacity:.92}
    .content{padding:22px 28px 26px;word-wrap:break-word}
    .badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-size:12px;font-weight:900;margin-bottom:12px}
    h2{margin:0 0 10px;color:#011848;font-size:22px;line-height:1.3}
    p{margin:0 0 14px;color:#475569;font-size:14px;line-height:1.65}
    .section-title{margin:20px 0 8px;color:#011848;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.6px}
    .info{margin:0 0 16px;border:1px solid #d8dfeb;border-radius:14px;overflow:hidden;background:#f8fafc}
    .info table{width:100%;border-collapse:collapse;table-layout:fixed}
    .info td{padding:11px 14px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:900}
    .value{color:#011848;font-weight:900;word-break:break-word;overflow-wrap:anywhere}
    .box{margin:18px 0;padding:14px 16px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:12px;color:#27457d;font-size:13px;line-height:1.6}
    .warning{background:#fff7ed;border-color:#fed7aa;border-left-color:#f97316;color:#9a3412}
    .footer{padding:16px 24px 20px;text-align:center;color:#64748b;font-size:12px;background:#fff}
    @media only screen and (max-width:620px){
      .card{width:100%!important}
      .content{padding:20px 16px 24px!important}
      .label,.value{display:block!important;width:auto!important}
      .label{padding-bottom:3px!important;border-bottom:0!important}
      .value{padding-top:0!important}
    }
  </style>
</head>
<body style="width:100%!important;margin:0;padding:0;background-color:#f4f6fb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6fb" style="width:100%;border-collapse:collapse;background-color:#f4f6fb;background-image:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%);">
    <tr>
      <td align="center" style="padding:16px 8px;">
        <table role="presentation" class="card" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;border:1px solid #d8dfeb;border-collapse:separate;border-spacing:0;background-color:#ffffff;border-radius:20px;overflow:hidden;">
          <tr>
            <td class="header" align="center" bgcolor="#011848" style="padding:10px 20px;background-color:#011848;background-image:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);border-radius:20px 20px 0 0;color:#ffffff;text-align:center;">
              <img src="${logoUrl}" alt="" width="48" style="display:block;width:48px;max-width:48px;height:auto;margin:0 auto 4px;border:0;outline:none;text-decoration:none;">
              <h1 style="margin:0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;line-height:25px;letter-spacing:-.2px;">Quality Control</h1>
              <p style="margin:3px 0 0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;">Ajuste necessário na solicitação</p>
            </td>
          </tr>
          <tr>
            <td class="content" style="padding:22px 28px 26px;color:#011848;font-family:Arial,Helvetica,sans-serif;word-wrap:break-word;">
              <span class="badge">Ajuste necessário</span>
              <h2>${greeting}</h2>
              <p>Sua solicitação de acesso precisa de ajuste antes de seguir para aprovação.</p>

              <div class="section-title">Observação do revisor</div>
              <div class="box warning">${observationHtml}</div>

              <div class="section-title">Código de consulta</div>
              <div class="info">
                <table>
                  <tr><td class="label">Código</td><td class="value">${safeAccessKey}</td></tr>
                  <tr><td class="label">Validade</td><td class="value">Este código expira em ${ttlMinutes} minutos.</td></tr>
                </table>
              </div>

              <div class="box">Para consultar e ajustar sua solicitação, acesse a tela de consulta e informe seu nome, e-mail e código de consulta.</div>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto 10px;border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="#ef0001" style="background-color:#ef0001;border-radius:9px;mso-padding-alt:11px 20px;">
                    <a href="${safeLookupUrl}" style="display:inline-block;padding:11px 20px;color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;line-height:18px;text-align:center;text-decoration:none;">Consultar solicitação</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;text-align:center;font-size:11px;line-height:17px;color:#64748b;word-break:break-all;">Acesse a consulta em: <a href="${safeLookupUrl}" style="color:#27457d;text-decoration:underline;">${safeLookupUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td class="footer" align="center" bgcolor="#ffffff" style="padding:16px 24px 20px;border-top:1px solid #e5eaf3;background-color:#ffffff;color:#64748b;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;text-align:center;">E-mail automático. Não responda.<br>© ${new Date().getFullYear()} Quality Control.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `${greetingText}

Sua solicitação de acesso precisa de ajuste antes de seguir para aprovação.

OBSERVAÇÃO DO REVISOR
${observation}

CÓDIGO DE CONSULTA
${data.accessKey}

Este código expira em ${ttlMinutes} minutos.

Para consultar e ajustar sua solicitação, acesse a tela de consulta e informe seu nome, e-mail e código.

Acesse a consulta em:
${lookupUrl}`;

    return this.sendEmail({
      to,
      subject: "Ajuste necessário na sua solicitação - Quality Control",
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
