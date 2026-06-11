from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

old = '''      await page.getByTestId("request-access-submit-button").click();

      await expect(page.getByRole("status")).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole("status")).toContainText(/recebida|enviada|análise|sucesso/i);'''

new = '''      const submitResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/access-requests/public") &&
          response.request().method() === "POST",
        { timeout: 60000 },
      );

      await page.getByTestId("request-access-submit-button").click();

      const submitResponse = await submitResponsePromise;
      const responseText = await submitResponse.text().catch(() => "");

      console.log("[ACCESS REQUEST PUBLIC RESPONSE]", {
        status: submitResponse.status(),
        body: responseText,
      });

      expect(submitResponse.ok(), responseText).toBeTruthy();

      await expect(page.getByRole("status")).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole("status")).toContainText(/recebida|enviada|análise|sucesso/i);'''

if old not in content:
    raise SystemExit("Não achei o trecho final para substituir.")

content = content.replace(old, new)

path.write_text(content, encoding="utf-8")
