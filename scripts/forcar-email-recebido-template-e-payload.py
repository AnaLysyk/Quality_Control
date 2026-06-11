from pathlib import Path
import re

# ============================================================
# 1) FRONT: força envio de password + companyDetails no payload
# ============================================================
front_path = Path("app/login/access-request/AccessRequestClient.tsx")
front = front_path.read_text(encoding="utf-8")

front = re.sub(
    r'\n\s*const companyDetailsForEmail = \{[\s\S]*?\n\s*\};\n',
    '\n',
    front,
)

front = front.replace("companyDetails: companyDetailsForEmail,", "")

company_details_block = '''password: normalizedPassword,
          senha: normalizedPassword,
          plainPassword: normalizedPassword,
          companyDetails: {
            companyName: normalizedCompanyDraft.companyName,
            fantasyName: normalizedCompanyDraft.fantasyName,
            cnpj: normalizedCompanyDraft.companyTaxId || normalizedCompanyDraft.cnpj,
            companyTaxId: normalizedCompanyDraft.companyTaxId,
            cep: normalizedCompanyDraft.cep,
            address: normalizedCompanyDraft.address,
            number: normalizedCompanyDraft.number,
            complement: normalizedCompanyDraft.complement,
            district: normalizedCompanyDraft.district,
            city: normalizedCompanyDraft.city,
            state: normalizedCompanyDraft.state,
            phone: normalizedCompanyDraft.phone,
            email: normalizedCompanyDraft.email,
            website: normalizedCompanyDraft.website,
            linkedin: normalizedCompanyDraft.linkedin || normalizedCompanyDraft.linkedIn,
            situation: normalizedCompanyDraft.situation,
            openingDate: normalizedCompanyDraft.openingDate,
            legalNature: normalizedCompanyDraft.legalNature,
            mainActivity: normalizedCompanyDraft.mainActivity,
            size: normalizedCompanyDraft.size,
            shareCapital: normalizedCompanyDraft.shareCapital,
          },'''

front = re.sub(
    r'password:\s*normalizedPassword,\s*(?:senha:\s*normalizedPassword,\s*)?(?:plainPassword:\s*normalizedPassword,\s*)?(?:companyDetails:\s*\{[\s\S]*?\},\s*)?',
    company_details_block + "\n          ",
    front,
    count=1,
)

front_path.write_text(front, encoding="utf-8")


# ============================================================
# 2) SERVICE: força envio de senha e detalhes para o email
# ============================================================
service_path = Path("lib/accessRequestsV2/service.ts")
service = service_path.read_text(encoding="utf-8")

if "function asRecord(" not in service:
    service = re.sub(
        r'(function asText\([\s\S]*?\n\})',
        r'''\1

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
''',
        service,
        count=1,
    )

if "function pickFirstText(" not in service:
    service = re.sub(
        r'(function asRecord\([\s\S]*?\n\})',
        r'''\1

function pickFirstText(payload: Record<string, unknown>, keys: string[], max = 255) {
  for (const key of keys) {
    const value = asText(payload[key], max);
    if (value) return value;
  }

  return "";
}
''',
        service,
        count=1,
    )

service = re.sub(
    r'const requestedPassword = [\s\S]*?;\n\s*const requestedPasswordHash',
    '''const requestedPassword = pickFirstText(payload, [
    "password",
    "senha",
    "plainPassword",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
  ], 255);
  const requestedPasswordHash''',
    service,
    count=1,
)

if "const companyDetailsPayload = asRecord(payload.companyDetails);" not in service:
    service = service.replace(
        "const requestedPasswordHash = requestedPassword ? hashPasswordSha256(requestedPassword) : undefined;",
        '''const requestedPasswordHash = requestedPassword ? hashPasswordSha256(requestedPassword) : undefined;
  const companyDetailsPayload = asRecord(payload.companyDetails);''',
        1,
    )

email_call = r'''void emailService.sendAccessRequestReceivedEmail(requesterEmail, {
    name: requesterName || null,
    accessKey: created.accessKey ?? created.id,
    email: requesterEmail,
    phone: asText(payload.phone, 80) || asText(payload.requesterPhone, 80) || null,
    password: requestedPassword || null,
    profileType: created.requestedRole ?? created.requestType,
    companyName:
      pickFirstText(companyDetailsPayload, ["companyName", "company_name", "razaoSocial", "razao_social"], 255) ||
      pickFirstText(payload, ["companyName", "company_name", "razaoSocial", "razao_social"], 255) ||
      null,
    title: asText(payload.title, 255) || null,
    description: reason ?? null,
    status: created.status,
    companyDetails: {
      ...companyDetailsPayload,
      companyName:
        pickFirstText(companyDetailsPayload, ["companyName", "company_name", "razaoSocial", "razao_social"], 255) ||
        pickFirstText(payload, ["companyName", "company_name", "razaoSocial", "razao_social"], 255),
      fantasyName:
        pickFirstText(companyDetailsPayload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255) ||
        pickFirstText(payload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255),
      cnpj:
        pickFirstText(companyDetailsPayload, ["cnpj", "companyTaxId", "company_tax_id"], 40) ||
        pickFirstText(payload, ["cnpj", "companyTaxId", "company_tax_id"], 40),
      cep:
        pickFirstText(companyDetailsPayload, ["cep"], 40) ||
        pickFirstText(payload, ["cep"], 40),
      address:
        pickFirstText(companyDetailsPayload, ["address", "endereco"], 255) ||
        pickFirstText(payload, ["address", "endereco"], 255),
      number:
        pickFirstText(companyDetailsPayload, ["number", "numero"], 40) ||
        pickFirstText(payload, ["number", "numero"], 40),
      complement:
        pickFirstText(companyDetailsPayload, ["complement", "complemento"], 255) ||
        pickFirstText(payload, ["complement", "complemento"], 255),
      district:
        pickFirstText(companyDetailsPayload, ["district", "bairro"], 120) ||
        pickFirstText(payload, ["district", "bairro"], 120),
      city:
        pickFirstText(companyDetailsPayload, ["city", "cidade", "municipio"], 120) ||
        pickFirstText(payload, ["city", "cidade", "municipio"], 120),
      state:
        pickFirstText(companyDetailsPayload, ["state", "uf"], 40) ||
        pickFirstText(payload, ["state", "uf"], 40),
      phone:
        pickFirstText(companyDetailsPayload, ["phone", "companyPhone"], 80) ||
        pickFirstText(payload, ["companyPhone"], 80),
      email:
        pickFirstText(companyDetailsPayload, ["email", "companyEmail"], 255) ||
        pickFirstText(payload, ["companyEmail"], 255),
      website:
        pickFirstText(companyDetailsPayload, ["website", "site"], 255) ||
        pickFirstText(payload, ["website", "site"], 255),
      linkedin:
        pickFirstText(companyDetailsPayload, ["linkedin", "linkedIn"], 255) ||
        pickFirstText(payload, ["linkedin", "linkedIn"], 255),
      situation:
        pickFirstText(companyDetailsPayload, ["situation", "situacao"], 120) ||
        pickFirstText(payload, ["situation", "situacao"], 120),
      openingDate:
        pickFirstText(companyDetailsPayload, ["openingDate", "dataAbertura"], 80) ||
        pickFirstText(payload, ["openingDate", "dataAbertura"], 80),
      legalNature:
        pickFirstText(companyDetailsPayload, ["legalNature", "naturezaJuridica"], 255) ||
        pickFirstText(payload, ["legalNature", "naturezaJuridica"], 255),
      mainActivity:
        pickFirstText(companyDetailsPayload, ["mainActivity", "atividadePrincipal"], 255) ||
        pickFirstText(payload, ["mainActivity", "atividadePrincipal"], 255),
      size:
        pickFirstText(companyDetailsPayload, ["size", "porte"], 80) ||
        pickFirstText(payload, ["size", "porte"], 80),
      shareCapital:
        pickFirstText(companyDetailsPayload, ["shareCapital", "capitalSocial"], 80) ||
        pickFirstText(payload, ["shareCapital", "capitalSocial"], 80),
    },
  }).catch((err: unknown) => console.error("[ACCESS-REQUESTS][V2][EMAIL][RECEIVED] failed", err));'''

service = re.sub(
    r'void emailService\.sendAccessRequestReceivedEmail\(requesterEmail, \{[\s\S]*?\}\)\.catch\(\(err: unknown\) => console\.error\("\[ACCESS-REQUESTS\]\[V2\]\[EMAIL\]\[RECEIVED\] failed", err\)\);',
    email_call,
    service,
    count=1,
)

service_path.write_text(service, encoding="utf-8")


# ============================================================
# 3) EMAIL: substitui método inteiro por template limpo
# ============================================================
email_path = Path("lib/email.ts")
email = email_path.read_text(encoding="utf-8")

new_method = r'''  async sendAccessRequestReceivedEmail(
    to: string,
    data: {
      name?: string | null;
      accessKey: string;
      email: string;
      phone?: string | null;
      password?: string | null;
      profileType?: string | null;
      companyName?: string | null;
      title?: string | null;
      description?: string | null;
      status?: string | null;
      companyDetails?: Record<string, unknown> | null;
    },
  ): Promise<boolean> {
    const statusUrl = `${this.resolvePublicBaseUrl()}/login/access-request/status?key=${data.accessKey}`;
    const greeting = data.name ? `Olá, ${data.name}!` : "Olá!";
    const profileLabel = String(data.profileType ?? "Perfil solicitado").replaceAll("_", " ");

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
      companyTaxId: "CNPJ",
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

    const companyRows = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => !hiddenKeys.has(key) && formatValue(value))
      .map(([key, value]) => {
        const label = labelMap[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
        return `<tr><td class="label">${label}</td><td class="value">${formatValue(value)}</td></tr>`;
      })
      .join("");

    const companySection = companyRows
      ? `<div class="section-title">Dados da empresa</div><div class="info"><table>${companyRows}</table></div>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Solicitação de acesso recebida - Quality Control</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb}
    .page{width:100%;padding:48px 12px;background:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%)}
    .card{max-width:820px;margin:0 auto;background:#fff;border:1px solid rgba(1,24,72,.12);border-radius:28px;overflow:hidden;box-shadow:0 26px 76px rgba(1,24,72,.26)}
    .header{background:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);color:#fff;padding:48px 46px;text-align:center}
    .brand{display:inline-block;margin:0 auto 16px;padding:9px 18px;border:1px solid rgba(255,255,255,.36);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:13px;font-weight:900;letter-spacing:.2px}
    .header h1{margin:0;font-size:30px;line-height:1.15;letter-spacing:-.4px}
    .header p{margin:10px 0 0;font-size:15px;opacity:.94}
    .content{padding:46px 50px 38px}
    .badge{display:inline-block;padding:9px 15px;border-radius:999px;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;font-size:13px;font-weight:900;margin-bottom:20px}
    h2{margin:0 0 14px;color:#011848;font-size:24px;line-height:1.3}
    p{margin:0 0 18px;color:#475569;font-size:14px;line-height:1.78}
    .section-title{margin:28px 0 10px;color:#011848;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.6px}
    .info{margin:0 0 20px;border:1px solid #d8dfeb;border-radius:18px;overflow:hidden;background:#f8fafc}
    .info table{width:100%;border-collapse:collapse}
    .info td{padding:15px 18px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:900}
    .value{color:#011848;font-weight:900;word-break:break-word}
    .box{margin:24px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d;font-size:13px;line-height:1.7}
    .buttonWrap{text-align:center;margin:32px 0 12px}
    .button{display:inline-block;padding:17px 40px;border-radius:15px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff!important;text-decoration:none;font-weight:900;font-size:15px;box-shadow:0 16px 30px rgba(239,0,1,.30)}
    .footer{padding:22px 30px 30px;text-align:center;color:#64748b;font-size:12px;background:#fff}
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="brand">Testing Company</div>
        <h1>Quality Control</h1>
        <p>Solicitação de acesso recebida</p>
      </div>
      <div class="content">
        <span class="badge">Em análise</span>
        <h2>${greeting}</h2>
        <p>Recebemos sua solicitação de acesso. Ela está em análise pela equipe responsável. Você receberá uma atualização quando for aprovada, recusada ou quando precisar de ajuste.</p>

        <div class="section-title">Dados de acesso cadastrados</div>
        <div class="info">
          <table>
            <tr><td class="label">Usuário / login</td><td class="value">${data.email}</td></tr>
            <tr><td class="label">Senha cadastrada</td><td class="value">${data.password ?? "Senha não recebida no payload"}</td></tr>
            <tr><td class="label">Perfil solicitado</td><td class="value">${profileLabel}</td></tr>
            <tr><td class="label">Código de consulta</td><td class="value">${data.accessKey}</td></tr>
          </table>
        </div>

        <div class="section-title">Dados do solicitante</div>
        <div class="info">
          <table>
            <tr><td class="label">Nome</td><td class="value">${data.name ?? "-"}</td></tr>
            <tr><td class="label">E-mail</td><td class="value">${data.email}</td></tr>
            <tr><td class="label">Telefone</td><td class="value">${data.phone ?? "-"}</td></tr>
          </table>
        </div>

        ${companySection}

        <div class="box">Guarde este código. Ele será usado junto com seu nome e e-mail para consultar o andamento da solicitação. Depois da aprovação, o acesso será feito com o usuário e senha cadastrados neste formulário.</div>

        <div class="buttonWrap">
          <a href="${statusUrl}" class="button">Consultar solicitação</a>
        </div>

        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">Link direto: ${statusUrl}</p>
      </div>
      <div class="footer">E-mail automático. Não responda.<br>© ${new Date().getFullYear()} Quality Control.</div>
    </div>
  </div>
</body>
</html>`;

    const companyText = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => !hiddenKeys.has(key) && formatValue(value))
      .map(([key, value]) => `${labelMap[key] ?? key}: ${formatValue(value)}`)
      .join("\\n");

    const text = `${greeting}

Recebemos sua solicitação de acesso.

DADOS DE ACESSO
Usuário / login: ${data.email}
Senha cadastrada: ${data.password ?? "Senha não recebida no payload"}
Perfil solicitado: ${profileLabel}
Código de consulta: ${data.accessKey}

DADOS DO SOLICITANTE
Nome: ${data.name ?? "-"}
E-mail: ${data.email}
Telefone: ${data.phone ?? "-"}

${companyText ? `DADOS DA EMPRESA\n${companyText}\n` : ""}

Consulte sua solicitação em:
${statusUrl}

Guarde este código para acompanhar sua solicitação.`;

    return this.sendEmail({
      to,
      subject: "Solicitação de acesso recebida - Quality Control",
      html,
      text,
    });
  }

'''

email = re.sub(
    r'  async sendAccessRequestReceivedEmail\([\s\S]*?\n  async sendAccessApprovedEmail\(',
    new_method + '  async sendAccessApprovedEmail(',
    email,
    count=1,
)

email_path.write_text(email, encoding="utf-8")
