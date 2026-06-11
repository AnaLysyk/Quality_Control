from pathlib import Path
import re

# =========================
# 1) DOMAIN
# =========================
domain_path = Path("lib/accessRequestsV2/domain.ts")
domain = domain_path.read_text(encoding="utf-8")

domain = domain.replace(
'''  targetUserId?: string;
  status: AccessRequestV2Status;''',
'''  targetUserId?: string;
  /**
   * Hash da senha escolhida pelo usuário no formulário público.
   * Nunca armazenar senha em texto puro.
   */
  requestedPasswordHash?: string;
  status: AccessRequestV2Status;'''
)

domain_path.write_text(domain, encoding="utf-8")


# =========================
# 2) REPOSITORY
# =========================
repo_path = Path("lib/accessRequestsV2/repository.ts")
repo = repo_path.read_text(encoding="utf-8")

repo = repo.replace(
'''  targetUserId?: string;
  reason?: string;''',
'''  targetUserId?: string;
  requestedPasswordHash?: string;
  reason?: string;'''
)

repo = repo.replace(
'''      targetUserId: parsed.targetUserId,
      reason: parsed.reason,''',
'''      targetUserId: parsed.targetUserId,
      requestedPasswordHash: parsed.requestedPasswordHash,
      reason: parsed.reason,'''
)

repo = repo.replace(
'''  let targetUserId: string | undefined;
  let requestedCompanySlug: string | undefined;''',
'''  let targetUserId: string | undefined;
  let requestedPasswordHash: string | undefined;
  let requestedCompanySlug: string | undefined;'''
)

repo = repo.replace(
'''      targetUserId = meta.targetUserId;
      requestedCompanySlug = meta.requestedCompanySlug;''',
'''      targetUserId = meta.targetUserId;
      requestedPasswordHash = meta.requestedPasswordHash;
      requestedCompanySlug = meta.requestedCompanySlug;'''
)

repo = repo.replace(
'''    targetUserId,
    status,''',
'''    targetUserId,
    requestedPasswordHash,
    status,'''
)

repo = repo.replace(
'''          targetUserId: meta.targetUserId,
          status: meta.status,''',
'''          targetUserId: meta.targetUserId,
          requestedPasswordHash: meta.requestedPasswordHash,
          status: meta.status,'''
)

repo = repo.replace(
'''  targetUserId?: string;
  reason?: string;''',
'''  targetUserId?: string;
  requestedPasswordHash?: string;
  reason?: string;'''
)

repo = repo.replace(
'''    targetUserId: input.targetUserId,
    status: "pending",''',
'''    targetUserId: input.targetUserId,
    requestedPasswordHash: input.requestedPasswordHash,
    status: "pending",'''
)

repo = repo.replace(
'''      targetUserId: request.targetUserId,
      reason: request.reason,''',
'''      targetUserId: request.targetUserId,
      requestedPasswordHash: request.requestedPasswordHash,
      reason: request.reason,'''
)

repo = repo.replace(
'''    targetUserId: request.targetUserId,
    reason: request.reason,''',
'''    targetUserId: request.targetUserId,
    requestedPasswordHash: request.requestedPasswordHash,
    reason: request.reason,'''
)

repo = repo.replace(
'''"status" | "priority" | "reviewedBy" | "reviewedAt" | "reviewComment" | "reason" | "adjustmentFields"''',
'''"status" | "priority" | "reviewedBy" | "reviewedAt" | "reviewComment" | "reason" | "adjustmentFields" | "requestedPasswordHash"'''
)

repo = repo.replace(
'''    ...(patch.reason !== undefined ? { reason: patch.reason } : {}),''',
'''    ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
    ...(patch.requestedPasswordHash !== undefined ? { requestedPasswordHash: patch.requestedPasswordHash } : {}),'''
)

repo = repo.replace(
'''      targetUserId: next.targetUserId,
      reason: next.reason,''',
'''      targetUserId: next.targetUserId,
      requestedPasswordHash: next.requestedPasswordHash,
      reason: next.reason,'''
)

repo = repo.replace(
'''    targetUserId: next.targetUserId,
    reason: next.reason,''',
'''    targetUserId: next.targetUserId,
    requestedPasswordHash: next.requestedPasswordHash,
    reason: next.reason,'''
)

repo_path.write_text(repo, encoding="utf-8")


# =========================
# 3) SERVICE
# =========================
service_path = Path("lib/accessRequestsV2/service.ts")
service = service_path.read_text(encoding="utf-8")

service = service.replace(
'''  const reason = asText(payload.reason, 2000) || asText(payload.description, 2000) || asText(payload.notes, 2000) || undefined;''',
'''  const reason = asText(payload.reason, 2000) || asText(payload.description, 2000) || asText(payload.notes, 2000) || undefined;
  const requestedPassword = asText(payload.password, 255);
  const requestedPasswordHash = requestedPassword ? hashPasswordSha256(requestedPassword) : undefined;'''
)

service = service.replace(
'''    targetUserId: asText(payload.targetUserId, 120) || undefined,
    reason,''',
'''    targetUserId: asText(payload.targetUserId, 120) || undefined,
    requestedPasswordHash,
    reason,'''
)

service = service.replace(
'''  // Gera sempre senha temporária ao aprovar, para enviar por e-mail
  const tempPassword = randomBytes(10).toString("hex");
  const tempPasswordHash = hashPasswordSha256(tempPassword);''',
'''  const passwordFromRequest = Boolean(request.requestedPasswordHash);
  const fallbackPassword = randomBytes(10).toString("hex");
  const passwordHash = request.requestedPasswordHash ?? hashPasswordSha256(fallbackPassword);'''
)

service = service.replace(
'''      password_hash: tempPasswordHash,''',
'''      password_hash: passwordHash,'''
)

service = service.replace(
'''    password_hash: tempPasswordHash,''',
'''    password_hash: passwordHash,'''
)

service = service.replace(
'''  return { userId: targetUser.id, tempPassword, login: targetUser.email ?? request.requesterEmail };''',
'''  return {
    userId: targetUser.id,
    login: targetUser.email ?? request.requesterEmail,
    tempPassword: passwordFromRequest ? null : fallbackPassword,
    passwordFromRequest,
  };'''
)

service = service.replace(
'''  let approvalCredentials: { userId: string; tempPassword: string; login: string } | null = null;''',
'''  let approvalCredentials: { userId: string; tempPassword: string | null; login: string; passwordFromRequest: boolean } | null = null;'''
)

service = service.replace(
'''        tempPassword: approvalCredentials.tempPassword,
        profileType: request.requestedRole,''',
'''        tempPassword: approvalCredentials.tempPassword,
        passwordFromRequest: approvalCredentials.passwordFromRequest,
        profileType: request.requestedRole,'''
)

service_path.write_text(service, encoding="utf-8")


# =========================
# 4) EMAIL APROVADO
# =========================
email_path = Path("lib/email.ts")
email = email_path.read_text(encoding="utf-8")

new_method = r'''async sendAccessApprovedEmail(
    to: string,
    data: {
      name?: string | null;
      login: string;
      tempPassword?: string | null;
      passwordFromRequest?: boolean;
      profileType?: string | null;
      companySlug?: string | null;
    },
  ): Promise<boolean> {
    const loginUrl = `${this.resolvePublicBaseUrl()}/login`;
    const greeting = data.name ? `Olá, ${data.name}!` : 'Olá!';
    const profileLabel = data.profileType ? data.profileType.replaceAll("_", " ") : 'perfil aprovado';
    const companyLine = data.companySlug
      ? `<tr><td class="label">Empresa</td><td class="value">${data.companySlug}</td></tr>`
      : '';

    const passwordLine = data.passwordFromRequest
      ? `<tr><td class="label">Senha</td><td class="value">Use a senha cadastrada na solicitação</td></tr>`
      : `<tr><td class="label">Senha</td><td class="value">${data.tempPassword ?? "Senha definida no cadastro"}</td></tr>`;

    const passwordText = data.passwordFromRequest
      ? "Senha: use a senha cadastrada na solicitação"
      : `Senha: ${data.tempPassword ?? "senha definida no cadastro"}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Acesso aprovado - Quality Control</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #011848;
      background: #f4f6fb;
    }
    .page {
      width: 100%;
      padding: 32px 12px;
      background: linear-gradient(135deg, #011848 0%, #f4f6fb 52%, #ef0001 100%);
    }
    .card {
      max-width: 640px;
      margin: 0 auto;
      background: rgba(255,255,255,0.96);
      border: 1px solid rgba(1,24,72,0.12);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 70px rgba(1,24,72,0.24);
    }
    .header {
      background: linear-gradient(135deg, #011848 0%, #ef0001 100%);
      color: #ffffff;
      padding: 36px 32px;
      text-align: center;
    }
    .logo {
      width: 72px;
      height: 72px;
      margin: 0 auto 16px;
      border-radius: 999px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.35);
      display: table;
    }
    .logo span {
      display: table-cell;
      vertical-align: middle;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -1px;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      line-height: 1.2;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.92;
    }
    .content {
      padding: 34px 32px 28px;
    }
    .badge {
      display: inline-block;
      padding: 8px 14px;
      border-radius: 999px;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 18px;
    }
    h2 {
      margin: 0 0 12px;
      color: #011848;
      font-size: 22px;
      line-height: 1.3;
    }
    p {
      margin: 0 0 16px;
      color: #475569;
      font-size: 14px;
      line-height: 1.75;
    }
    .info {
      margin: 24px 0;
      border: 1px solid #d8dfeb;
      border-radius: 18px;
      overflow: hidden;
      background: #f8fafc;
    }
    .info table {
      width: 100%;
      border-collapse: collapse;
    }
    .info td {
      padding: 14px 16px;
      border-bottom: 1px solid #e5eaf3;
      font-size: 14px;
      vertical-align: top;
    }
    .info tr:last-child td {
      border-bottom: 0;
    }
    .label {
      width: 34%;
      color: #64748b;
      font-weight: 700;
    }
    .value {
      color: #011848;
      font-weight: 700;
      word-break: break-word;
    }
    .notice {
      margin: 22px 0;
      padding: 16px 18px;
      background: #f0f4ff;
      border: 1px solid #d8dfeb;
      border-left: 5px solid #011848;
      border-radius: 16px;
      color: #27457d;
      font-size: 13px;
      line-height: 1.65;
    }
    .buttonWrap {
      text-align: center;
      margin: 28px 0 10px;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      border-radius: 14px;
      background: linear-gradient(135deg, #011848 0%, #ef0001 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
      box-shadow: 0 12px 24px rgba(239,0,1,0.20);
    }
    .footer {
      padding: 20px 28px 28px;
      text-align: center;
      color: #64748b;
      font-size: 12px;
      background: #ffffff;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="logo"><span>QC</span></div>
        <h1>Quality Control</h1>
        <p>Solicitação de acesso aprovada</p>
      </div>

      <div class="content">
        <span class="badge">✓ Acesso aprovado</span>

        <h2>${greeting}</h2>

        <p>
          Sua solicitação foi aprovada. Agora você já pode acessar a plataforma
          Quality Control com os dados abaixo.
        </p>

        <div class="info">
          <table>
            <tr><td class="label">Login</td><td class="value">${data.login}</td></tr>
            ${passwordLine}
            <tr><td class="label">Perfil</td><td class="value">${profileLabel}</td></tr>
            ${companyLine}
          </table>
        </div>

        <div class="notice">
          A senha é a mesma informada no momento da solicitação.
          Depois do primeiro acesso, você pode trocar a senha em
          <strong>Meu Perfil → Alterar Senha</strong>, caso queira.
        </div>

        <div class="buttonWrap">
          <a href="${loginUrl}" class="button">Acessar o sistema</a>
        </div>

        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">
          Link direto: ${loginUrl}
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

    const text = `${greeting}

Sua solicitação de acesso foi aprovada.

Login: ${data.login}
${passwordText}
Perfil: ${profileLabel}

Acesse em: ${loginUrl}

A senha é a mesma informada no momento da solicitação. Depois do primeiro acesso, você pode trocar a senha em Meu Perfil > Alterar Senha, caso queira.`;

    return this.sendEmail({
      to,
      subject: 'Acesso aprovado - Quality Control',
      html,
      text,
    });
  }

  '''

email = re.sub(
    r"async sendAccessApprovedEmail\([\s\S]*?\n  async sendAccessRejectedEmail\(",
    new_method + "async sendAccessRejectedEmail(",
    email,
)

email_path.write_text(email, encoding="utf-8")
