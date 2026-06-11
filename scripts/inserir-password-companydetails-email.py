from pathlib import Path

path = Path("lib/accessRequestsV2/service.ts")
content = path.read_text(encoding="utf-8")

old = '''    phone,
    profileType: created.requestType,'''

new = '''    phone,
    password: passwordForReceivedEmail || requestedPassword || null,
    companyDetails: companyDetailsForReceivedEmail,
    profileType: created.requestType,'''

if old not in content:
    raise SystemExit("Não achei o trecho exato: phone, profileType")

content = content.replace(old, new, 1)

path.write_text(content, encoding="utf-8")
