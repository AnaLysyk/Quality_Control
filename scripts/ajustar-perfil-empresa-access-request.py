from pathlib import Path

path = Path("app/login/access-request/AccessRequestClient.tsx")
content = path.read_text(encoding="utf-8-sig")

# Garante opção Empresa no topo
if 'value: "empresa",' not in content:
    content = content.replace(
'''const ACCESS_OPTIONS = [
  {
    value: "testing_company_user",''',
'''const ACCESS_OPTIONS = [
  {
    value: "empresa",
    label: "Empresa",
    hint: "Cadastro institucional de uma nova empresa.",
  },
  {
    value: "testing_company_user",'''
    )

# Empresa é perfil institucional, não usuário da empresa
content = content.replace(
'const isCompanyProfile = accessType === "company_user";',
'const isCompanyProfile = accessType === "empresa";'
)

content = content.replace(
'const isCompanyAccessRequest = accessType === "company_user";',
'const isCompanyAccessRequest = accessType === "empresa";'
)

content = content.replace(
'const isLookupCompanyAccessRequest = lookupDraft?.accessType === "company_user";',
'const isLookupCompanyAccessRequest = lookupDraft?.accessType === "empresa";'
)

# Payload correto para Empresa
content = content.replace(
'''          requestType: accessType,
          requestedRole: accessType,''',
'''          requestType: accessType === "empresa" ? "company_creation" : accessType,
          requestedRole: accessType,''',
1
)

path.write_text(content, encoding="utf-8")
