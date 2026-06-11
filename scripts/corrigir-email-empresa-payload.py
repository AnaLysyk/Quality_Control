from pathlib import Path
import re

# ============================================================
# 1) Corrige HTML/CSS quebrado no e-mail
# ============================================================

email_path = Path("lib/email.ts")
email = email_path.read_text(encoding="utf-8")

replacements = {
    "padding:46px50px 38px": "padding:46px 50px 38px",
    ".infotd{": ".info td{",
    "<divclass=": "<div class=",
    "<tdclass=": "<td class=",
    "comseu nome": "com seu nome",
}

for old, new in replacements.items():
    email = email.replace(old, new)

email_path.write_text(email, encoding="utf-8")


# ============================================================
# 2) Faz o service enviar senha + todos os dados seguros da empresa
# ============================================================

service_path = Path("lib/accessRequestsV2/service.ts")
service = service_path.read_text(encoding="utf-8")

# adiciona helper depois do asEmail
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

function buildSafeAccessRequestDetails(payload: Record<string, unknown>) {
  const blocked = new Set([
    "password",
    "senha",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
    "confirmPassword",
    "passwordConfirmation",
    "captcha",
    "token",
    "accessKey",
  ]);

  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (blocked.has(key)) return false;
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object") return false;
      return true;
    }),
  );
}
'''
    )

# garante password lido de vários nomes possíveis
service = re.sub(
    r'const requestedPassword = asText\(payload\.password, 255\);',
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
)

# substitui companyDetails manual por payload seguro completo
service = re.sub(
    r'''companyDetails:\s*\{[\s\S]*?\n    \},\n  \}\)\.catch''',
'''companyDetails: {
      ...buildSafeAccessRequestDetails(payload),
      companyName:
        pickFirstText(payload, ["companyName", "company_name", "razaoSocial", "razao_social", "company"], 255),
      fantasyName: pickFirstText(payload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255),
      cnpj: pickFirstText(payload, ["cnpj", "companyCnpj", "company_cnpj"], 40),
      cep: pickFirstText(payload, ["cep", "companyCep", "company_cep"], 40),
      address: pickFirstText(payload, ["address", "endereco", "companyAddress", "company_address"], 255),
      number: pickFirstText(payload, ["number", "numero", "companyNumber", "company_number"], 40),
      complement: pickFirstText(payload, ["complement", "complemento"], 255),
      district: pickFirstText(payload, ["district", "bairro"], 120),
      city: pickFirstText(payload, ["city", "cidade", "municipio"], 120),
      state: pickFirstText(payload, ["state", "uf"], 40),
      phone: pickFirstText(payload, ["companyPhone", "phoneCompany", "company_phone"], 80),
      email: pickFirstText(payload, ["companyEmail", "emailCompany", "company_email"], 255),
      situation: pickFirstText(payload, ["situation", "situacao", "descricao_situacao_cadastral"], 120),
      openingDate: pickFirstText(payload, ["openingDate", "dataAbertura", "data_inicio_atividade"], 80),
      legalNature: pickFirstText(payload, ["legalNature", "naturezaJuridica", "natureza_juridica"], 255),
      mainActivity: pickFirstText(payload, ["mainActivity", "atividadePrincipal", "cnae_fiscal_descricao"], 255),
      size: pickFirstText(payload, ["size", "porte"], 80),
      shareCapital: pickFirstText(payload, ["shareCapital", "capitalSocial", "capital_social"], 80),
    },
  }).catch''',
    service,
)

service_path.write_text(service, encoding="utf-8")
