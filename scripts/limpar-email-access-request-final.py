from pathlib import Path

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

fixes = {
    "<divclass=": "<div class=",
    "<tdclass=": "<td class=",
    "Usuário /login": "Usuário / login",
    "UsuÃ¡rio /login": "Usuário / login",
    "análisepela": "análise pela",
    "anÃ¡lisepela": "análise pela",
    "Recebemossua": "Recebemos sua",
    "Telefoneda empresa": "Telefone da empresa",
    "solicitaçãoem": "solicitação em",
    "solicitaÃ§Ã£oem": "solicitação em",
    "Depoisda": "Depois da",
    "dasolicitação": "da solicitação",
}

for old, new in fixes.items():
    content = content.replace(old, new)

# Remove CNPJ duplicado no HTML/texto quando companyTaxId repetir cnpj
content = content.replace(
    'companyTaxId: "CNPJ",',
    'companyTaxId: "CNPJ duplicado",'
)

content = content.replace(
    'if (hasCnpj && key === "companyTaxId") return false;',
    'if (hasCnpj && (key === "companyTaxId" || key === "company_tax_id")) return false;'
)

# Caso o filtro ainda não exista, injeta no companyRows
if 'const hasCnpj = Boolean(formatValue((data.companyDetails ?? {}).cnpj));' not in content:
    content = content.replace(
        'const companyRows = Object.entries(data.companyDetails ?? {})',
        'const hasCnpj = Boolean(formatValue((data.companyDetails ?? {}).cnpj));\n\n    const companyRows = Object.entries(data.companyDetails ?? {})',
        1,
    )

content = content.replace(
    '.filter(([key, value]) => !hiddenKeys.has(key) && formatValue(value))',
    '''.filter(([key, value]) => {
        if (hiddenKeys.has(key)) return false;
        if (hasCnpj && (key === "companyTaxId" || key === "company_tax_id")) return false;
        return Boolean(formatValue(value));
      })'''
)

path.write_text(content, encoding="utf-8")
