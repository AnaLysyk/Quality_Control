from pathlib import Path
import re

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

new_function = '''async function openRequestForm(page: import("@playwright/test").Page) {
  await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });

  const formSelect = page.getByTestId("request-access-role-select");

  for (let attempt = 1; attempt <= 3; attempt++) {
    const openButtons = [
      page.getByTestId("open-request-access-form-button"),
      page.getByRole("button", { name: /^Solicitar acesso$/i }),
      page.getByRole("button", { name: /criar solicitação/i }),
      page.getByRole("button", { name: /nova solicitação/i }),
      page.getByRole("button", { name: /pedir acesso/i }),
    ];

    for (const locator of openButtons) {
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index++) {
        const button = locator.nth(index);

        if (!(await button.isVisible().catch(() => false))) {
          continue;
        }

        await button.scrollIntoViewIfNeeded().catch(() => undefined);
        await expect(button).toBeEnabled({ timeout: 10000 });
        await button.click();

        const opened = await formSelect
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => true)
          .catch(() => false);

        if (opened) {
          return;
        }
      }
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(1000);
  }

  const debug = await page.locator("button").evaluateAll((buttons) =>
    buttons.map((button, index) => ({
      index,
      text: (button.textContent ?? "").trim(),
      testid: button.getAttribute("data-testid"),
      aria: button.getAttribute("aria-label"),
      disabled: button.hasAttribute("disabled"),
    })),
  );

  const bodyText = await page.locator("body").innerText().catch(() => "");

  throw new Error(
    `Não abriu o formulário de solicitação. Botões encontrados: ${JSON.stringify(
      debug,
      null,
      2,
    )}\\n\\nTexto da tela:\\n${bodyText}`,
  );
}'''

content = re.sub(
    r'async function openRequestForm\(page: import\("@playwright/test"\)\.Page\) \{[\s\S]*?\n\}',
    new_function,
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
