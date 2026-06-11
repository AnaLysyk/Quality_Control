from pathlib import Path

path = Path("app/login/access-request/AccessRequestClient.tsx")
content = path.read_text(encoding="utf-8-sig")

old = '''          user: accessType === "technical_support" ? normalizedRequestedUser || undefined : undefined,''';

new = '''          user: normalizedRequestedUser || undefined,''';

if old not in content:
    raise SystemExit("Não achei a linha antiga do campo user.")

content = content.replace(old, new, 1)

path.write_text(content, encoding="utf-8")
