from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

old = '''      await expect(
        page.getByText(/solicitação|recebida|enviada|sucesso|análise/i),
      ).toBeVisible({ timeout: 60000 });'''

new = '''      await expect(page.getByRole("status")).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole("status")).toContainText(/recebida|enviada|análise|sucesso/i);'''

if old not in content:
    raise SystemExit("Não achei o expect final antigo.")

content = content.replace(old, new)

path.write_text(content, encoding="utf-8")
