from pathlib import Path
import re

# =========================
# FRONT: envia senha + dados da empresa
# =========================
front_path = Path("app/login/access-request/AccessRequestClient.tsx")
front = front_path.read_text(encoding="utf-8")

front = re.sub(
    r'\n\s*const companyDetailsForEmail = \{[\s\S]*?\n\s*\};\n',
    '\n',
    front,
    count=1,
)

front = front.replace("companyDetails: companyDetailsForEmail,", "")

# adiciona companyDetails logo depois de password: normalizedPassword
if "companyDetails: {" not in front:
    front = front.replace(
        "password: normalizedPassword,",
        """password: normalizedPassword,
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
            linkedin: normalizedCompanyDraft.linkedin,
            linkedIn: normalizedCompanyDraft.linkedIn,
            situation: normalizedCompanyDraft.situation,
            openingDate: normalizedCompanyDraft.openingDate,
            legalNature: normalizedCompanyDraft.legalNature,
            mainActivity: normalizedCompanyDraft.mainActivity,
            size: normalizedCompanyDraft.size,
            shareCapital: normalizedCompanyDraft.shareCapital,
          },""",
        1,
    )

front_path.write_text(front, encoding="utf-8")


# =========================
# SERVICE: garante leitura da senha e companyDetails
# =========================
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

if "const companyEmailDetails =" not in service:
    marker = "void emailService.sendAccessRequestReceivedEmail(requesterEmail, {"
    service = service.replace(
        marker,
        '''const companyEmailDetails = {
    ...companyDetailsPayload,
    companyName:
      pickFirstText(companyDetailsPayload, ["companyName", "company_name", "razaoSocial", "razao_social", "company"], 255) ||
      pickFirstText(payload, ["companyName", "company_name", "razaoSocial", "razao_social", "company"], 255),
    fantasyName:
      pickFirstText(companyDetailsPayload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255) ||
      pickFirstText(payload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255),
    cnpj:
      pickFirstText(companyDetailsPayload, ["cnpj", "companyTaxId", "company_tax_id", "companyCnpj", "company_cnpj"], 40) ||
      pickFirstText(payload, ["cnpj", "companyTaxId", "company_tax_id", "companyCnpj", "company_cnpj"], 40),
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
    website:
      pickFirstText(companyDetailsPayload, ["website", "site", "companyWebsite", "company_website"], 255) ||
      pickFirstText(payload, ["website", "site", "companyWebsite", "company_website"], 255),
    linkedin:
      pickFirstText(companyDetailsPayload, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255) ||
      pickFirstText(payload, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255),
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
  };

  void emailService.sendAccessRequestReceivedEmail(requesterEmail, {''',
        1,
    )

# força password e companyDetails dentro do envio
service = re.sub(
    r'password:\s*[^,\n]+,',
    '''password:
      pickFirstText(payload, ["password", "senha", "plainPassword", "userPassword", "accessPassword", "requestPassword", "requestedPassword"], 255) ||
      requestedPassword ||
      null,''',
    service,
    count=1,
)

service = re.sub(
    r'companyDetails:\s*\{[\s\S]*?\n\s*\},',
    'companyDetails: companyEmailDetails,',
    service,
    count=1,
)

service_path.write_text(service, encoding="utf-8")


# =========================
# EMAIL: corrige HTML/CSS e labels
# =========================
email_path = Path("lib/email.ts")
email = email_path.read_text(encoding="utf-8")

fixes = {
    "padding:46px50px 38px": "padding:46px 50px 38px",
    ".infotd{": ".info td{",
    "<divclass=": "<div class=",
    "<tdclass=": "<td class=",
    "solicitaÃ§Ã£o deacesso": "solicitação de acesso",
    "nesteformulÃ¡rio": "neste formulário",
    "Senhacadastrada": "Senha cadastrada",
}

for old, new in fixes.items():
    email = email.replace(old, new)

extra_labels = {
    'companyTaxId': 'CNPJ',
    'company_tax_id': 'CNPJ',
    'website': 'Website',
    'site': 'Website',
    'companyWebsite': 'Website',
    'linkedin': 'LinkedIn',
    'linkedIn': 'LinkedIn',
    'companyLinkedin': 'LinkedIn',
    'companyLinkedIn': 'LinkedIn',
}

for key, label in extra_labels.items():
    needle = f'      {key}: "{label}",'
    if needle not in email and "const labelMap" in email:
        email = email.replace("      shareCapital: \"Capital social\",", f"      shareCapital: \"Capital social\",\n{needle}")

email_path.write_text(email, encoding="utf-8")
