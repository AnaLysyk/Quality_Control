from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

old = '''      await page.getByRole("combobox", { name: /cargo/i }).click();
      await page.getByRole("option", { name: "Analista de QA" }).click();'''

new = '''      const cargoCombobox = page.getByRole("combobox", { name: /cargo/i });
      if (await cargoCombobox.isVisible().catch(() => false)) {
        await cargoCombobox.click();
        await page.getByRole("option", { name: "Analista de QA" }).click();
      } else {
        await page.locator("label", { hasText: /Cargo|função/i }).locator("select").selectOption("Analista de QA");
      }'''

if old not in content:
    raise SystemExit("Não achei o trecho do cargo para substituir.")

content = content.replace(old, new)

path.write_text(content, encoding="utf-8")
