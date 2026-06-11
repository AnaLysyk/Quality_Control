from pathlib import Path
import re

# ============================================================
# 1) Corrige HTML/CSS quebrado no lib/email.ts
# ============================================================
email_path = Path("lib/email.ts")
email = email_path.read_text(encoding="utf-8")

fixes = {
    "padding:46px50px 38px": "padding:46px 50px 38px",
    ".infotd{": ".info td{",
    "<divclass=": "<div class=",
    "<tdclass=": "<td class=",
    "comseu nome": "com seu nome",
    "estecÃ³digo": "este código",
    "estecódigo": "este código",
}

for old, new in fixes.items():
    email = email.replace(old, new)

email_path.write_text(email, encoding="utf-8")


# ============================================================
# 2) Garante que o frontend envie senha + dados da empresa
# ============================================================
front_path = Path("app/login/access-request/AccessRequestClient.tsx")
front = front_path.read_text(encoding="utf-8")

# cria objeto companyDetails antes do envio, se ainda não existir
if "const companyDetailsForEmail" not in front:
    marker = "const payload = {"
    insert = '''const companyDetailsForEmail = {
      companyName: normalizedCompanyDraft.companyName,
      fantasyName: normalizedCompanyDraft.fantasyName,
      cnpj: normalizedCompanyDraft.cnpj,
      cep: normalizedCompanyDraft.cep,
      address: normalizedCompanyDraft.address,
      number: normalizedCompanyDraft.number,
      complement: normalizedCompanyDraft.complement,
      district: normalizedCompanyDraft.district,
      city: normalizedCompanyDraft.city,
      state: normalizedCompanyDraft.state,
      phone: normalizedCompanyDraft.phone,
      email: normalizedCompanyDraft.email,
      situation: normalizedCompanyDraft.situation,
      openingDate: normalizedCompanyDraft.openingDate,
      legalNature: normalizedCompanyDraft.legalNature,
      mainActivity: normalizedCompanyDraft.mainActivity,
      size: normalizedCompanyDraft.size,
      shareCapital: normalizedCompanyDraft.shareCapital,
    };

    '''
    front = front.replace(marker, insert + marker, 1)

# adiciona password e companyDetails no payload principal, logo após email
front = re.sub(
    r'(email:\s*normalizedEmail,\s*)',
    r'\1password: normalizedPassword,\n      companyDetails: companyDetailsForEmail,\n      companyName: normalizedCompanyDraft.companyName,\n      cnpj: normalizedCompanyDraft.cnpj,\n      cep: normalizedCompanyDraft.cep,\n      address: normalizedCompanyDraft.address,\n      companyPhone: normalizedCompanyDraft.phone,\n      companyEmail: normalizedCompanyDraft.email,\n      ',
    front,
    count=1,
)

front_path.write_text(front, encoding="utf-8")


# ============================================================
# 3) Garante que o backend leia senha e dados da empresa
# ============================================================
service_path = Path("lib/accessRequestsV2/service.ts")
service = service_path.read_text(encoding="utf-8")

if "function pickFirstText(" not in service:
    service = service.replace(
'''function asEmail(value: unknown) {
  return asText(value, 255).toLowerCase();
}
''',
'''function asEmail(value: unknown) {
  return asText(value, 255).toLowerCase();
}

function pickFirstText(payload: Record<string, unknown>, keys: string[], max = 255) {
  for (const key of keys) {
    const value = asText(payload[key], max);
    if (value) return value;
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
'''
    )

service = re.sub(
    r'const requestedPassword = .*?;',
'''const requestedPassword = pickFirstText(payload, [
    "password",
    "senha",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
    "plainPassword",
  ], 255);''',
    service,
    count=1,
    flags=re.S,
)

# garante variável companyDetailsPayload dentro da função de criação
if "const companyDetailsPayload = asRecord(payload.companyDetails);" not in service:
    service = service.replace(
        "const requestedPasswordHash = requestedPassword ? hashPasswordSha256(requestedPassword) : undefined;",
        '''const requestedPasswordHash = requestedPassword ? hashPasswordSha256(requestedPassword) : undefined;
  const companyDetailsPayload = asRecord(payload.companyDetails);''',
        1,
    )

# troca companyDetails enviado ao e-mail para usar o objeto completo vindo do front
service = re.sub(
    r'companyDetails:\s*\{[\s\S]*?\n\s*\},\n\s*\}\)\.catch',
'''companyDetails: {
      ...companyDetailsPayload,
      companyName:
        pickFirstText(companyDetailsPayload, ["companyName", "company_name", "razaoSocial", "razao_social", "company"], 255) ||
        pickFirstText(payload, ["companyName", "company_name", "razaoSocial", "razao_social", "company"], 255),
      fantasyName:
        pickFirstText(companyDetailsPayload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255) ||
        pickFirstText(payload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255),
      cnpj:
        pickFirstText(companyDetailsPayload, ["cnpj", "companyCnpj", "company_cnpj"], 40) ||
        pickFirstText(payload, ["cnpj", "companyCnpj", "company_cnpj"], 40),
      cep:
        pickFirstText(companyDetailsPayload, ["cep", "companyCep", "company_cep"], 40) ||
        pickFirstText(payload, ["cep", "companyCep", "company_cep"], 40),
      address:
        pickFirstText(companyDetailsPayload, ["address", "endereco", "companyAddress", "company_address"], 255) ||
        pickFirstText(payload, ["address", "endereco", "companyAddress", "company_address"], 255),
      number:
        pickFirstText(companyDetailsPayload, ["number", "numero", "companyNumber", "company_number"], 40) ||
        pickFirstText(payload, ["number", "numero", "companyNumber", "company_number"], 40),
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
        pickFirstText(companyDetailsPayload, ["phone", "companyPhone", "phoneCompany", "company_phone"], 80) ||
        pickFirstText(payload, ["companyPhone", "phoneCompany", "company_phone"], 80),
      email:
        pickFirstText(companyDetailsPayload, ["email", "companyEmail", "emailCompany", "company_email"], 255) ||
        pickFirstText(payload, ["companyEmail", "emailCompany", "company_email"], 255),
      situation:
        pickFirstText(companyDetailsPayload, ["situation", "situacao", "descricao_situacao_cadastral"], 120) ||
        pickFirstText(payload, ["situation", "situacao", "descricao_situacao_cadastral"], 120),
      openingDate:
        pickFirstText(companyDetailsPayload, ["openingDate", "dataAbertura", "data_inicio_atividade"], 80) ||
        pickFirstText(payload, ["openingDate", "dataAbertura", "data_inicio_atividade"], 80),
      legalNature:
        pickFirstText(companyDetailsPayload, ["legalNature", "naturezaJuridica", "natureza_juridica"], 255) ||
        pickFirstText(payload, ["legalNature", "naturezaJuridica", "natureza_juridica"], 255),
      mainActivity:
        pickFirstText(companyDetailsPayload, ["mainActivity", "atividadePrincipal", "cnae_fiscal_descricao"], 255) ||
        pickFirstText(payload, ["mainActivity", "atividadePrincipal", "cnae_fiscal_descricao"], 255),
      size:
        pickFirstText(companyDetailsPayload, ["size", "porte"], 80) ||
        pickFirstText(payload, ["size", "porte"], 80),
      shareCapital:
        pickFirstText(companyDetailsPayload, ["shareCapital", "capitalSocial", "capital_social"], 80) ||
        pickFirstText(payload, ["shareCapital", "capitalSocial", "capital_social"], 80),
    },
  }).catch''',
    service,
    count=1,
    flags=re.S,
)

service_path.write_text(service, encoding="utf-8")
