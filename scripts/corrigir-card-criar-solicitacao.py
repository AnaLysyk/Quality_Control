from pathlib import Path
import re

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

content = re.sub(
    r'async function openRequestForm\(page: import\("@playwright/test"\)\.Page\) \{[\s\S]*?\n\}',
    '''async function openRequestForm(page: import("@playwright/test").Page) {
  const createCard = page
    .locator("div")
    .filter({ hasText: /Criar solicitação|Solicitar acesso|Nova solicitação/i })
    .filter({ has: page.locator("button") })
    .last();

  await expect(createCard).toBeVisible({ timeout: 30000 });

  const createButton = createCard.locator("button").last();
  await expect(createButton).toBeVisible({ timeout: 30000 });
  await createButton.click();

  await expect(page.getByTestId("request-access-role-select")).toBeVisible({
    timeout: 30000,
  });
}''',
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
