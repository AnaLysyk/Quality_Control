from pathlib import Path

path = Path("lib/email.ts")
lines = path.read_text(encoding="utf-8").splitlines()

fixed = []
i = 0

while i < len(lines):
    current = lines[i].strip()

    if current == '.join("' and i + 1 < len(lines) and lines[i + 1].strip() == '");':
        indent = lines[i][: len(lines[i]) - len(lines[i].lstrip())]
        fixed.append(indent + '.join("\\\\n");')
        i += 2
        continue

    fixed.append(lines[i])
    i += 1

path.write_text("\n".join(fixed) + "\n", encoding="utf-8")
