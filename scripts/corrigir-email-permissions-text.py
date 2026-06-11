from pathlib import Path
import re

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

# Corrige qualquer variação quebrada do join do permissionsText
content = re.sub(
    r'const permissionsText = contentByRole\.permissions\.map\(\(item\) => `- \$\{item\}`\)\.join\([\s\S]*?\);',
    'const permissionsText = contentByRole.permissions.map((item) => `- ${item}`).join("\\\\n");',
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
