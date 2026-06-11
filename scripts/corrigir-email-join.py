from pathlib import Path

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

content = content.replace(
'''const permissionsText = contentByRole.permissions.map((item) => `- ${item}`).join("
");''',
'''const permissionsText = contentByRole.permissions.map((item) => `- ${item}`).join("\\n");'''
)

path.write_text(content, encoding="utf-8")
