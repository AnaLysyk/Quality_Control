from pathlib import Path
import re

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

# Correções simples de HTML/CSS/texto quebrado
fixes = {
    "padding:46px50px 38px": "padding:46px 50px 38px",
    ".infotd{": ".info td{",
    "<divclass=": "<div class=",
    "<tdclass=": "<td class=",
    "Usuário /login": "Usuário / login",
    "UsuÃ¡rio /login": "Usuário / login",
    "Depoisda aprovação": "Depois da aprovação",
    "dasolicitação": "da solicitação",
    "Consulta sua solicitaçãoem": "Consulte sua solicitação em",
}

for old, new in fixes.items():
    content = content.replace(old, new)

# Troca label cru do perfil por label amigável
content = content.replace(
    'const profileLabel = String(data.profileType ?? "Perfil solicitado").replaceAll("_", " ");',
    '''const profileLabels: Record<string, string> = {
      company_user: "Usuário da empresa",
      testing_company_user: "Usuário Testing Company",
      leader_tc: "Líder TC",
      technical_support: "Suporte técnico",
      company_access: "Empresa",
    };

    const profileKey = String(data.profileType ?? "").trim();
    const profileLabel = profileLabels[profileKey] ?? (profileKey ? profileKey.replaceAll("_", " ") : "Perfil solicitado");'''
)

# Remove CNPJ duplicado quando existir cnpj + companyTaxId
content = content.replace(
    '''const companyRows = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => !hiddenKeys.has(key) && formatValue(value))
      .map(([key, value]) => {''',
    '''const hasCnpj = Boolean(formatValue((data.companyDetails ?? {}).cnpj));

    const companyRows = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => {
        if (hiddenKeys.has(key)) return false;
        if (hasCnpj && key === "companyTaxId") return false;
        return Boolean(formatValue(value));
      })
      .map(([key, value]) => {'''
)

# Mesmo tratamento no texto puro
content = content.replace(
    '''const companyText = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => !hiddenKeys.has(key) && formatValue(value))
      .map(([key, value]) => `${labelMap[key] ?? key}: ${formatValue(value)}`)
      .join("\\\\n");''',
    '''const companyText = Object.entries(data.companyDetails ?? {})
      .filter(([key, value]) => {
        if (hiddenKeys.has(key)) return false;
        if (hasCnpj && key === "companyTaxId") return false;
        return Boolean(formatValue(value));
      })
      .map(([key, value]) => `${labelMap[key] ?? key}: ${formatValue(value)}`)
      .join("\\\\n");'''
)

path.write_text(content, encoding="utf-8")
