from pathlib import Path
import re

path = Path("lib/requestRouting.ts")
content = path.read_text(encoding="utf-8")

content = re.sub(
    r'export function requestProfileTypeNeedsCompany\(profileType: RequestProfileType\) \{[\s\S]*?\n\}',
    '''export function requestProfileTypeNeedsCompany(profileType: RequestProfileType) {
  // Usuário da empresa e Usuário TC sempre precisam estar vinculados a uma empresa existente.
  return profileType === "company_user" || profileType === "testing_company_user";
}''',
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
