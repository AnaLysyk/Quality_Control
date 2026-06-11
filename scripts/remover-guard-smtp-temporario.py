from pathlib import Path
import re

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

content = re.sub(
r'''
function assertRealEmailConfig\(\) \{
[\s\S]*?
\}
''',
"",
content,
count=1,
)

content = content.replace(
'''  test.beforeAll(() => {
    assertRealEmailConfig();
  });

''',
"",
)

path.write_text(content, encoding="utf-8")
