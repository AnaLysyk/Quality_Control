import { expect, test, type Page } from "@playwright/test";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../support/functions/access-requests/access-requests.email";

async function abrirFormularioSolicitacao(page: Page) {
  const botaoAbrir = page.getByTestId("open-request-access-form-button");
  const formulario = page.getByTestId("request-access-form");

  await expect(botaoAbrir).toBeVisible({ timeout: 30000 });

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    const jaAberto = await formulario.isVisible().catch(() => false);

    if (jaAberto) {
      return;
    }

    console.log(`[REAL FRONT] Tentando abrir formulário: tentativa ${tentativa}`);

    await botaoAbrir.scrollIntoViewIfNeeded();
    await botaoAbrir.click({ force: true });

    await page.waitForTimeout(1500);
  }

  const textoTela = await page.locator("body").innerText().catch(() => "");
  console.log("[REAL FRONT] Formulário não abriu. Texto visível da tela:");
  console.log(textoTela);

  await page.screenshot({
    path: "test-results/access-request-form-nao-abriu.png",
    fullPage: true,
  });

  await expect(formulario).toBeVisible({ timeout: 30000 });
}

test.describe("Solicitação de acesso - fluxo real pelo navegador", () => {
  test.setTimeout(180000);

  test("deve criar solicitação, capturar e-mail e consultar status pela chave recebida", async ({ page }) => {
    const email = criarEmailTeste("fluxo-real-front");

    await limparEmailsCapturados();

    await page.goto("/login/access-request", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await abrirFormularioSolicitacao(page);

    await page.getByTestId("request-access-role-select").selectOption("technical_support");

    await page.getByTestId("request-access-name-input").fill("Ana Teste Fluxo Real");
    const usuarioInput = page
  .getByTestId("request-access-user-input")
  .or(page.getByTestId("request-access-username-input"))
  .or(page.getByLabel(/usuário|usuario|login/i));

if (await usuarioInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
  await usuarioInput.first().fill("ana.fluxo.real");
}
    await page.getByTestId("request-access-email-input").fill(email);
    const telefoneInput = page
  .getByTestId("request-access-phone-input")
  .or(page.getByLabel(/telefone|celular|phone/i))
  .or(page.locator('input[type="tel"]'));

if (await telefoneInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
  await telefoneInput.first().fill("+55 51 99999-9999");
}

    await page.getByRole("combobox").filter({ hasText: /selecione uma profissão/i }).click();
    await page.getByRole("option", { name: /analista/i }).first().click();

    await page.getByTestId("request-access-title-input").fill("Solicitação de acesso para teste real");
    await page.getByTestId("request-access-reason-input").fill("Teste real pelo navegador para validar fluxo completo da solicitação.");
    await page.getByTestId("request-access-password-input").fill("SenhaTeste123!");

    await expect(page.getByTestId("request-access-submit-button")).toBeEnabled({
      timeout: 30000,
    });

    await page.getByTestId("request-access-submit-button").click();

    await expect(page.getByText("Request submitted successfully")).toBeVisible({
      timeout: 90000,
    });

    const emailRecebido = await esperarEmailCapturado({
      to: email,
      subject: "Solicitação de acesso recebida",
      contains: ["Código de consulta"],
    });

    const corpo = `${emailRecebido.text ?? ""}\n${emailRecebido.html ?? ""}`;

    const chave =
      corpo.match(/Chave de acesso:?\s*([A-Za-z0-9_-]{8,})/i)?.[1] ??
      corpo.match(/key=([A-Za-z0-9_-]+)/i)?.[1];

    expect(chave, "Chave/accessKey deve existir no e-mail capturado").toBeTruthy();

    console.log("[REAL FRONT] CHAVE CAPTURADA:", chave);

    await page.goto(`/login/access-request/status?key=${chave}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    await expect(page.getByTestId("access-request-status-result")).toBeVisible({
      timeout: 90000,
    });

    await expect(page.getByRole("heading", { name: "Acompanhamento da solicitação" })).toBeVisible();
    await expect(page.getByTestId("access-request-status-label")).toContainText("Aguardando análise");
    await expect(page.getByText("Sua solicitação foi recebida")).toBeVisible();
    await expect(page.getByText("Dados da solicitação")).toBeVisible();
    await expect(page.getByText("Ana Teste Fluxo Real")).toBeVisible();
    await expect(page.getByTestId("access-request-status-email")).toContainText(email);
    await expect(page.getByText("Suporte técnico")).toBeVisible();

    await expect(page.getByText("medium")).toHaveCount(0);
    await expect(page.getByText("technical_support")).toHaveCount(0);
  });
});

