import { expect, type Page } from "@playwright/test";

export async function abrirStatusPorLink(page: Page, accessKey: string) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/access-requests/by-key/"),
    { timeout: 15000 },
  );

  await page.goto(`/login/access-request/status?key=${encodeURIComponent(accessKey)}`, {
    waitUntil: "domcontentloaded",
  });

  const response = await responsePromise.catch(() => null);

  if (!response) {
    throw new Error("A tela não chamou /api/access-requests/by-key ao abrir link de status.");
  }

  const bodyText = await response.text().catch(() => "");

  const result = page.getByTestId("access-request-status-result");
  const error = page.getByTestId("access-request-status-error");

  await expect(result.or(error)).toBeVisible({ timeout: 15000 });

  if (await error.isVisible().catch(() => false)) {
    throw new Error(
      `Erro na consulta de status UI: ${await error.textContent()} | API=${response.status()} ${bodyText}`,
    );
  }

  await expect(result).toBeVisible({ timeout: 15000 });
}
