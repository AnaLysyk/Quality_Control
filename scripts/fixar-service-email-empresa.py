from pathlib import Path
import re

path = Path("lib/accessRequestsV2/service.ts")
content = path.read_text(encoding="utf-8")

# ============================================================
# 1) Garante helpers usados no envio de e-mail
# ============================================================

if "function readTextFromPayload(" not in content:
    content = re.sub(
        r'(function asText\([\s\S]*?\n\})',
        r'''\1

function readTextFromPayload(payload: Record<string, unknown>, keys: string[], max = 255) {
  for (const key of keys) {
    const value = asText(payload[key], max);
    if (value) return value;
  }

  return "";
}

function readRecordFromPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function buildCompanyDetailsForEmail(payload: Record<string, unknown>) {
  const companyDetails = readRecordFromPayload(payload.companyDetails);

  const details: Record<string, unknown> = {
    ...companyDetails,

    companyName:
      readTextFromPayload(companyDetails, ["companyName", "company_name", "razaoSocial", "razao_social"], 255) ||
      readTextFromPayload(payload, ["companyName", "company_name", "razaoSocial", "razao_social", "company_name"], 255),

    fantasyName:
      readTextFromPayload(companyDetails, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255) ||
      readTextFromPayload(payload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255),

    cnpj:
      readTextFromPayload(companyDetails, ["cnpj", "companyTaxId", "company_tax_id"], 40) ||
      readTextFromPayload(payload, ["cnpj", "companyTaxId", "company_tax_id"], 40),

    cep:
      readTextFromPayload(companyDetails, ["cep", "companyCep", "company_cep"], 40) ||
      readTextFromPayload(payload, ["cep", "companyCep", "company_cep"], 40),

    address:
      readTextFromPayload(companyDetails, ["address", "endereco", "companyAddress", "company_address"], 255) ||
      readTextFromPayload(payload, ["address", "endereco", "companyAddress", "company_address"], 255),

    number:
      readTextFromPayload(companyDetails, ["number", "numero", "companyNumber", "company_number"], 40) ||
      readTextFromPayload(payload, ["number", "numero", "companyNumber", "company_number"], 40),

    complement:
      readTextFromPayload(companyDetails, ["complement", "complemento"], 255) ||
      readTextFromPayload(payload, ["complement", "complemento"], 255),

    district:
      readTextFromPayload(companyDetails, ["district", "bairro"], 120) ||
      readTextFromPayload(payload, ["district", "bairro"], 120),

    city:
      readTextFromPayload(companyDetails, ["city", "cidade", "municipio"], 120) ||
      readTextFromPayload(payload, ["city", "cidade", "municipio"], 120),

    state:
      readTextFromPayload(companyDetails, ["state", "uf"], 40) ||
      readTextFromPayload(payload, ["state", "uf"], 40),

    phone:
      readTextFromPayload(companyDetails, ["phone", "companyPhone", "phoneCompany", "company_phone"], 80) ||
      readTextFromPayload(payload, ["companyPhone", "phoneCompany", "company_phone"], 80),

    email:
      readTextFromPayload(companyDetails, ["email", "companyEmail", "emailCompany", "company_email"], 255) ||
      readTextFromPayload(payload, ["companyEmail", "emailCompany", "company_email"], 255),

    website:
      readTextFromPayload(companyDetails, ["website", "site", "companyWebsite", "company_website"], 255) ||
      readTextFromPayload(payload, ["website", "site", "companyWebsite", "company_website"], 255),

    linkedin:
      readTextFromPayload(companyDetails, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255) ||
      readTextFromPayload(payload, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255),
  };

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object") return false;
      return true;
    }),
  );
}
''',
        content,
        count=1,
    )

# ============================================================
# 2) Força senha lida direto do payload recebido
# ============================================================

content = re.sub(
    r'const requestedPassword = [\s\S]*?;\n\s*const requestedPasswordHash',
    '''const requestedPassword = readTextFromPayload(payload, [
    "password",
    "senha",
    "plainPassword",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
  ], 255);
  const requestedPasswordHash''',
    content,
    count=1,
)

# ============================================================
# 3) Coloca objetos prontos antes do envio do e-mail
# ============================================================

if "const passwordForReceivedEmail =" not in content:
    content = content.replace(
        "void emailService.sendAccessRequestReceivedEmail(requesterEmail, {",
        '''const passwordForReceivedEmail = readTextFromPayload(payload, [
    "password",
    "senha",
    "plainPassword",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
  ], 255);

  const companyDetailsForReceivedEmail = buildCompanyDetailsForEmail(payload);

  console.log("[ACCESS-REQUESTS][V2][EMAIL][PAYLOAD]", {
    hasPassword: Boolean(passwordForReceivedEmail),
    companyDetailKeys: Object.keys(companyDetailsForReceivedEmail),
  });

  void emailService.sendAccessRequestReceivedEmail(requesterEmail, {''',
        1,
    )

# ============================================================
# 4) Troca password e companyDetails dentro do envio
# ============================================================

content = re.sub(
    r'password:\s*[\s\S]*?\n\s*profileType:',
    '''password: passwordForReceivedEmail || requestedPassword || null,
    profileType:''',
    content,
    count=1,
)

content = re.sub(
    r'companyDetails:\s*(?:companyEmailDetails|\{[\s\S]*?\n\s*\}),',
    '''companyDetails: companyDetailsForReceivedEmail,''',
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
