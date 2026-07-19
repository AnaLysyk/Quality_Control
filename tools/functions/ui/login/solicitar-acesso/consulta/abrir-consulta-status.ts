import { expect, type Page } from "@playwright/test";

export async function abrirStatusPorLink(page: Page, accessKey: string) {
  const responsePromise = page
    .waitForResponse(
      (response) => response.url().includes("/api/access-requests/by-key/"),
      { timeout: 90000 },
    )
    .catch(() => null);

  await page.goto(`/login/access-request/status?key=${encodeURIComponent(accessKey)}`, {
    waitUntil: "domcontentloaded",
  });

  const result = page.getByTestId("access-request-status-result");
  const error = page.getByTestId("access-request-status-error");

  await expect(result.or(error)).toBeVisible({ timeout: 90000 });

  const response = await responsePromise;
  const bodyText = response ? await response.text().catch(() => "") : "";

  if (await error.isVisible().catch(() => false)) {
    throw new Error(
      `Erro na consulta de status UI: ${await error.textContent()} | API=${response?.status() ?? "sem resposta"} ${bodyText}`,
    );
  }

  await expect(result).toBeVisible({ timeout: 90000 });
}

