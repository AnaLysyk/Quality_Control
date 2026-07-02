import { expect, type Page } from "@playwright/test";

export async function abrirFormularioSolicitacaoPublica(
  page: Page,
  options: {
    screenshotPath?: string;
    waitAfterLoadMs?: number;
  } = {},
) {
  const botaoAbrir = page.getByTestId("open-request-access-form-button");
  const formulario = page.getByTestId("request-access-form");

  await expect(botaoAbrir).toBeVisible({ timeout: 30000 });

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(options.waitAfterLoadMs ?? 2000);
  await expect
    .poll(
      () =>
        botaoAbrir.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          const props = propsKey
            ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey]
            : null;
          return typeof props?.onClick === "function";
        }),
      {
        message: "Esperando o botao de solicitar acesso concluir a hidratacao.",
        timeout: 60000,
      },
    )
    .toBe(true);

  for (let attemptsRemaining = 6; attemptsRemaining > 0; attemptsRemaining -= 1) {
    const jaAberto = await formulario.isVisible().catch(() => false);

    if (jaAberto) {
      return;
    }

    await botaoAbrir.scrollIntoViewIfNeeded();
    await botaoAbrir.click();

    await expect(formulario).toBeVisible({ timeout: 3000 }).catch(() => undefined);
  }

  await page.screenshot({
    path: options.screenshotPath ?? "test-results/access-request-form-nao-abriu.png",
    fullPage: true,
  });

  await expect(formulario).toBeVisible({ timeout: 30000 });
}

export async function selecionarCargoAnalista(page: Page) {
  await page.getByRole("combobox").filter({ hasText: /selecione uma profissão/i }).click();
  await page.getByRole("option", { name: /analista/i }).first().click();
}

