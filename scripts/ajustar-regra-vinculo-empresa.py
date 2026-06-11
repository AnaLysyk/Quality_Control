from pathlib import Path

path = Path("lib/requestRouting.ts")
content = path.read_text(encoding="utf-8")

content = content.replace(
'''export function requestProfileTypeNeedsCompany(profileType: RequestProfileType) {
  // This helper means "requires selecting an existing company". Company/company_user requests can carry company profile data.
  return profileType === "testing_company_user";
}''',
'''export function requestProfileTypeNeedsCompany(profileType: RequestProfileType) {
  // Usuário da empresa e usuário TC sempre precisam estar vinculados a uma empresa existente.
  return profileType === "company_user" || profileType === "testing_company_user";
}'''
)

path.write_text(content, encoding="utf-8")
