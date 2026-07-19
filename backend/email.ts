import nodemailer from 'nodemailer';
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

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
        disableFileAccess: true,
        disableUrlAccess: true,
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
    // Sempre uma URL http(s) real, nunca "data:" embutido em base64: o Gmail
    // (e outros webmails) bloqueia/remove imagens embutidas como data URI em
    // e-mails recebidos por segurança, deixando o logo quebrado no cliente
    // real mesmo quando renderiza normalmente em um preview local.
    return this.resolveEmailLogoUrl();
  }

  // Casca visual única para todos os e-mails da plataforma (Design System -
  // Testing Company): fundo em gradiente navy→vermelho cobrindo a página,
  // card grande arredondado, logo circular no header, badge de status e
  // rodapé com a marca. Baseado no padrão já usado em aprovação/rejeição de
  // acesso, escolhido como referência pra unificar todos os e-mails.
  private buildEmailShell(options: {
    pageTitle: string;
    headerSubtitle: string;
    badgeText: string;
    badgeVariant: "success" | "danger" | "info" | "warning";
    bodyHtml: string;
  }) {
    const badgeColors: Record<typeof options.badgeVariant, { bg: string; color: string; border: string }> = {
      success: { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
      danger: { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
      info: { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
      warning: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
    };
    const badge = badgeColors[options.badgeVariant];
    const logoSrc = escapeHtml(this.resolveEmailLogoSrc());

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.pageTitle)} - Quality Control</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb}
    table{border-collapse:collapse}
    .header h1{margin:0;font-size:22px;line-height:1.15;letter-spacing:-.2px}
    .header p{margin:8px 0 0;font-size:13px;color:#ffffff;opacity:1;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.35)}
    .badge{display:inline-block;padding:8px 14px;border-radius:999px;background:${badge.bg};color:${badge.color};border:1px solid ${badge.border};font-size:13px;font-weight:800;margin-bottom:18px}
    h2{margin:0 0 12px;color:#011848;font-size:23px;line-height:1.3}
    p{margin:0 0 16px;color:#475569;font-size:14px;line-height:1.75}
    .section-title{margin:20px 0 8px;color:#011848;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.6px}
    .info{margin:24px 0;border:1px solid #d8dfeb;border-radius:18px;overflow:hidden;background:#f8fafc}
    .info table{width:100%}
    .info td{padding:15px 18px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:800}
    .value{color:#011848;font-weight:800;word-break:break-word}
    .box{margin:22px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d;font-size:13px;line-height:1.65}
    .box strong{color:#011848}
    .box.warning{background:#fff7ed;border-color:#fed7aa;border-left-color:#f97316;color:#9a3412}
    .box.warning strong{color:#9a3412}
    .reasonBox{margin:22px 0;padding:18px 20px;background:#fff1f2;border:1px solid #fecdd3;border-left:5px solid #ef4444;border-radius:16px;color:#7f1d1d;font-size:14px;line-height:1.65}
    .reasonBox strong{color:#7f1d1d}
    .list{margin:10px 0 0;padding-left:20px;color:#27457d}
    .list li{margin:7px 0}
    .cred-box{background:linear-gradient(135deg,#f9fafb 0%,#ffffff 100%);border:2px solid #d8dfeb;border-radius:14px;padding:18px 20px;margin:22px 0}
    .cred-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #d8dfeb}
    .cred-row:last-child{border-bottom:none}
    .cred-label{color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
    .cred-value{color:#011848;font-weight:800;font-size:14px;font-family:'Monaco','Courier New',monospace}
    .steps{margin:22px 0}
    .steps-title{font-weight:800;margin-bottom:12px;color:#011848;font-size:14px}
    .step{display:flex;gap:14px;margin:8px 0;padding:6px 0;align-items:flex-start}
    .step-number{display:flex;align-items:center;justify-content:center;width:26px;height:26px;min-width:26px;background:#011848;color:#fff;border-radius:50%;font-size:12px;font-weight:800}
    .step-text{color:#475569;font-size:13px;padding-top:4px}
    .buttonWrap{text-align:center;margin:32px 0 12px}
    .button{display:inline-block;padding:16px 38px;border-radius:14px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#ffffff!important;text-decoration:none;font-weight:900;font-size:15px;box-shadow:0 14px 28px rgba(239,0,1,.28)}
    @media only screen and (max-width:620px){
      .email-card{width:100%!important;border-radius:0!important}
      .email-content{padding:28px 20px 24px!important}
      .label,.value{display:block!important;width:auto!important}
      .label{padding-bottom:3px!important;border-bottom:0!important}
      .value{padding-top:0!important}
    }
    .email-logo-spin{animation:emailLogoSpin 18s linear infinite}
    @keyframes emailLogoSpin{
      from{transform:rotate(0deg)}
      to{transform:rotate(360deg)}
    }
    @media (prefers-reduced-motion:reduce){
      .email-logo-spin{animation:none!important}
    }
  </style>
  <!--[if mso]>
  <style>
    .email-logo-spin{animation:none!important;transform:none!important}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6fb" style="width:100%;background-color:#f4f6fb;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" class="email-card" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid rgba(1,24,72,.14);border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" bgcolor="#011848" class="header" style="background-color:#011848;background-image:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);padding:28px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 14px;">
                <tr>
                  <td align="center" bgcolor="#ffffff" width="74" height="74" style="width:74px;height:74px;border-radius:999px;background-color:#ffffff;">
                    <img class="email-logo-spin" src="${logoSrc}" alt="" width="74" height="74" style="display:block;width:74px;height:74px;object-fit:cover;border-radius:999px;border:0;outline:none;text-decoration:none;" />
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.15;letter-spacing:-.2px;">Quality Control</h1>
              <p style="margin:8px 0 0;color:#ffffff;font-size:13px;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.35);">${escapeHtml(options.headerSubtitle)}</p>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:36px 40px 32px;">
              <span class="badge">${options.badgeText}</span>
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#ffffff" style="padding:20px 28px 28px;text-align:center;color:#64748b;font-size:12px;background-color:#ffffff;">
              E-mail automático. Não responda.<br>
              © ${new Date().getFullYear()} Testing Company. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
        disableFileAccess: true,
        disableUrlAccess: true,
        // Evita quoted-printable: com acentos, o nodemailer insere quebras de
        // linha "soft break" que, em certos clientes/parsers, corrompem links
        // longos (ex.: "?key=ABC..." vira "?key<byte inválido>C..." quando a
        // quebra cai logo antes de outro caractere escapado). Base64 não sofre
        // desse problema de reinterpretação textual.
        textEncoding: 'base64' as const,
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

    const bodyHtml = `
        <h2>Crie uma nova senha</h2>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Quality Control.</p>
        <p>Use o botão abaixo para escolher uma nova senha. O link é individual e válido por 15 minutos.</p>

        <div class="buttonWrap">
          <a href="${safeResetUrl}" class="button">Redefinir senha</a>
        </div>

        <div class="box">Se você não solicitou esta alteração, ignore este e-mail. Sua senha atual continuará válida.</div>

        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">Link direto: <a href="${safeResetUrl}" style="color:#27457d;text-decoration:underline;">${safeResetUrl}</a></p>`;

    const html = this.buildEmailShell({
      pageTitle: "Redefinir senha",
      headerSubtitle: "Segurança da sua conta",
      badgeText: "Redefinição de senha",
      badgeVariant: "info",
      bodyHtml,
    });

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
    const greetingText = fullName ? `Olá, ${fullName}!` : 'Olá!';
    const greeting = fullName ? `Olá, ${escapeHtml(fullName)}!` : 'Olá!';

    const bodyHtml = `
        <h2>${greeting}</h2>
        <p>Sua conta foi criada com sucesso! Você agora tem acesso à plataforma <strong>Quality Control da Testing Company</strong>.</p>

        <div class="section-title">Suas credenciais de acesso</div>
        <div class="cred-box">
          <div class="cred-row">
            <span class="cred-label">Login</span>
            <span class="cred-value">${escapeHtml(login)}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Senha</span>
            <span class="cred-value">${escapeHtml(tempPassword)}</span>
          </div>
        </div>

        <div class="buttonWrap">
          <a href="${escapeHtml(loginUrl)}" class="button">Acessar a plataforma</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">Link direto: ${escapeHtml(loginUrl)}</p>

        <div class="steps">
          <p class="steps-title">Seus próximos passos</p>
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

        <div class="box warning">
          <strong>Importante:</strong> Esta senha é <strong>temporária</strong> e foi gerada pelo sistema. Troque-a imediatamente após seu primeiro acesso, em <strong>Meu Perfil → Alterar Senha</strong>. Não compartilhe estas credenciais com outras pessoas.
        </div>`;

    const html = this.buildEmailShell({
      pageTitle: "Bem-vindo ao Testing Company",
      headerSubtitle: "Bem-vindo à plataforma",
      badgeText: "Conta criada",
      badgeVariant: "success",
      bodyHtml,
    });

    const text = `
Quality Control - Seus dados de acesso

${greetingText}

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
      technical_support: "Administrador",
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

    const bodyHtml = `
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

        <div class="box">Guarde este código. O botão abaixo abre a consulta desta solicitação; se o prazo expirar, use "Reenviar código" na tela de consulta para receber uma nova chave válida.</div>

        <div class="buttonWrap">
          <a href="${escapeHtml(lookupUrl)}" class="button">Consultar solicitação</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">Acesse a consulta em: <a href="${escapeHtml(lookupUrl)}" style="color:#27457d;text-decoration:underline;">${escapeHtml(lookupUrl)}</a></p>`;

    const html = this.buildEmailShell({
      pageTitle: "Solicitação de acesso recebida",
      headerSubtitle: "Solicitação de acesso recebida",
      badgeText: "Em análise",
      badgeVariant: "info",
      bodyHtml,
    });

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
        label: "Administrador",
        subject: "Solicitação de acesso como administrador aprovada",
        title: "Solicitação de acesso como administrador aprovada",
        intro: "Seu acesso como administrador foi aprovado na plataforma Quality Control.",
        accessContext: "Este perfil permite atuar nos fluxos operacionais e de suporte conforme as permissões liberadas.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acompanhar solicitações e atendimentos",
          "Apoiar usuários e empresas vinculadas",
          "Atuar em revisões permitidas para administrador",
          "Utilizar recursos técnicos liberados para seu perfil",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira as filas e solicitações disponíveis",
          "Atue apenas nos fluxos liberados para administrador",
          "Altere sua senha após o primeiro acesso",
        ],
        badge: "Administrador aprovado",
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

    const bodyHtml = `
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
          <strong>Meu Perfil → Alterar Senha</strong>. A senha temporária ficará válida por 10 dias após a aprovação. Após esse prazo, utilize a opção <strong>"Esqueci minha senha"</strong> para recuperar o acesso.
        </div>

        <div class="buttonWrap">
          <a href="${escapeHtml(loginUrl)}" class="button">Acessar o sistema</a>
        </div>

        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">
          Link direto: ${escapeHtml(loginUrl)}
        </p>`;

    const html = this.buildEmailShell({
      pageTitle: contentByRole.subject,
      headerSubtitle: contentByRole.title,
      badgeText: `✓ ${contentByRole.badge}`,
      badgeVariant: "success",
      bodyHtml,
    });

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
    const comment = data.comment || "Recusado por dados incompatíveis.";

    const statusButton = statusUrl
      ? `<div class="buttonWrap"><a href="${escapeHtml(statusUrl)}" class="button">Consultar solicitação</a></div>
         <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">Link direto: ${escapeHtml(statusUrl)}</p>`
      : "";

    const bodyHtml = `
        <h2>${greeting}</h2>

        <p>Infelizmente sua solicitação de acesso foi <strong>rejeitada</strong>.</p>

        <div class="reasonBox">
          <strong>Motivo informado:</strong> ${escapeHtml(comment)}
        </div>

        ${statusButton}

        <div class="box">
          Se tiver dúvidas, entre em contato com a equipe de suporte.
        </div>`;

    const html = this.buildEmailShell({
      pageTitle: "Solicitação de acesso rejeitada",
      headerSubtitle: "Solicitação de acesso rejeitada",
      badgeText: "✕ Solicitação rejeitada",
      badgeVariant: "danger",
      bodyHtml,
    });

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

    const bodyHtml = `
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

        <div class="buttonWrap">
          <a href="${safeLookupUrl}" class="button">Consultar solicitação</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">Acesse a consulta em: <a href="${safeLookupUrl}" style="color:#27457d;text-decoration:underline;">${safeLookupUrl}</a></p>`;

    const html = this.buildEmailShell({
      pageTitle: "Ajuste necessário na solicitação",
      headerSubtitle: "Ajuste necessário na solicitação",
      badgeText: "Ajuste necessário",
      badgeVariant: "warning",
      bodyHtml,
    });

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
