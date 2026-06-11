from pathlib import Path
import re

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

content = re.sub(
    r'\nasync function seedCompany\(page: import\("@playwright/test"\)\.Page\) \{[\s\S]*?\n\}\n',
    "\n",
    content,
    count=1,
)

content = re.sub(
    r'\n\s*test\.beforeEach\(async \(\{ page \}\) => \{\s*await seedCompany\(page\);\s*\}\);\n',
    "\n",
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
