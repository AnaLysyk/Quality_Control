from pathlib import Path
import re

path = Path("app/api/access-requests/public/route.ts")
content = path.read_text(encoding="utf-8")

content = re.sub(
    r'\s*console\.log\("\[ACCESS-REQUESTS\]\[PUBLIC\]\[BODY\]", \{[\s\S]*?\n\s*\}\);\n',
    "\n",
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
