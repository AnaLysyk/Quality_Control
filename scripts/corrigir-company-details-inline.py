from pathlib import Path
import re

path = Path("app/login/access-request/AccessRequestClient.tsx")
content = path.read_text(encoding="utf-8")

# Remove bloco solto do companyDetailsForEmail, se existir
content = re.sub(
    r'\n\s*const companyDetailsForEmail = \{[\s\S]*?\n\s*\};\n',
    '\n',
    content,
    count=1,
)

# Troca referência quebrada por objeto inline
content = content.replace(
    "companyDetails: companyDetailsForEmail,",
    """companyDetails: {
            companyName: normalizedCompanyDraft.companyName,
            fantasyName: normalizedCompanyDraft.fantasyName,
            cnpj: normalizedCompanyDraft.companyTaxId || normalizedCompanyDraft.cnpj,
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
          },""",
)

path.write_text(content, encoding="utf-8")
