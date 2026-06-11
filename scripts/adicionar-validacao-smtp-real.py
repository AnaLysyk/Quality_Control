from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

needle = '''const REAL_EMAIL = "ana.testing.company@gmail.com";
const PASSWORD = "TESTE123456";'''

replacement = '''const REAL_EMAIL = "ana.testing.company@gmail.com";
const PASSWORD = "TESTE123456";

function assertRealEmailConfig() {
  const required = [
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_PORT",
    "EMAIL_SMTP_USER",
    "EMAIL_SMTP_PASS",
    "EMAIL_FROM",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Teste de e-mail real sem SMTP configurado. Variáveis ausentes: ${missing.join(", ")}`,
    );
  }
}'''

if needle not in content:
    raise SystemExit("Não achei o bloco das constantes.")

content = content.replace(needle, replacement, 1)

content = content.replace(
'''  test.setTimeout(120_000);''',
'''  test.setTimeout(120_000);

  test.beforeAll(() => {
    assertRealEmailConfig();
  });''',
1
)

path.write_text(content, encoding="utf-8")
