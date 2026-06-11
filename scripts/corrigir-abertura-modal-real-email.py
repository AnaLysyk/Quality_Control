from pathlib import Path
import re

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

content = re.sub(
    r'async function openRequestForm\(page: import\("@playwright/test"\)\.Page\) \{[\s\S]*?\n\}',
    '''async function openRequestForm(page: import("@playwright/test").Page) {
  const createButton = page
    .locator("button")
    .filter({ hasText: /solicitar|criar|acesso/i })
    .last();

  await expect(createButton).toBeVisible({ timeout: 30000 });
  await createButton.click();

  await expect(page.getByTestId("request-access-role-select")).toBeVisible({
    timeout: 30000,
  });
}''',
    content,
    count=1,
)

# Remove expectativa duplicada depois da chamada, porque agora a função já valida.
content = content.replace(
    '''
      await expect(page.getByTestId("request-access-role-select")).toBeVisible({ timeout: 30000 });

      await page.getByTestId("request-access-role-select").selectOption(profile.value);''',
    '''
      await page.getByTestId("request-access-role-select").selectOption(profile.value);''',
)

path.write_text(content, encoding="utf-8")
