from pathlib import Path

path = Path("app/login/access-request/AccessRequestClient.tsx")
content = path.read_text(encoding="utf-8-sig")

old = '''    const normalizedRole = role.trim();'''

new = '''    const normalizedRole =
      accessType === "empresa" && !role.trim()
        ? "Responsável pela empresa"
        : role.trim();'''

if old not in content:
    raise SystemExit("Não achei const normalizedRole = role.trim();")

content = content.replace(old, new, 1)

path.write_text(content, encoding="utf-8")
