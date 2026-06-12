import { expect, test } from "@playwright/test";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../support/functions/api/solicitar-acesso/capturar-emails";
import {
  abrirFormularioSolicitacaoPublica,
  selecionarCargoAnalista,
} from "../../../support/functions/interface/solicitar-acesso/preencher-formulario-publico";

test.describe("Solicitação de acesso - fluxo real pelo navegador", () => {
  test.setTimeout(180000);

  test("deve criar solicitação, capturar e-mail e consultar status pela chave recebida", async ({ page }) => {
    const email = criarEmailTeste("fluxo-real-front");

    await limparEmailsCapturados();

    await page.goto("/login/access-request", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await abrirFormularioSolicitacaoPublica(page, {
      screenshotPath: "test-results/access-request-form-nao-abriu.png",
      waitAfterLoadMs: 3000,
    });

    await page.getByTestId("request-access-role-select").selectOption("technical_support");

    await page.getByTestId("request-access-name-input").fill("Solicitante Fluxo Completo");

    const usuarioInput = page
      .getByTestId("request-access-user-input")
      .or(page.getByTestId("request-access-username-input"))
      .or(page.getByLabel(/usuário|usuario|login/i));

    if (await usuarioInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await usuarioInput.first().fill("solicitante.fluxo.completo");
    }

    await page.getByTestId("request-access-email-input").fill(email);

    const telefoneInput = page
      .getByTestId("request-access-phone-input")
      .or(page.getByLabel(/telefone|celular|phone/i))
      .or(page.locator('input[type="tel"]'));

    if (await telefoneInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await telefoneInput.first().fill("+55 51 99999-9999");
    }

    await selecionarCargoAnalista(page);

    await page.getByTestId("request-access-title-input").fill("Solicitação de acesso");
    await page.getByTestId("request-access-reason-input").fill("Validação completa do fluxo de solicitação.");
    await page
      .getByTestId("request-access-password-input")
      .fill(process.env.E2E_PROFILE_PASSWORD ?? "");

    await expect(page.getByTestId("request-access-submit-button")).toBeEnabled({
      timeout: 30000,
    });

    await page.getByTestId("request-access-submit-button").click();

    await expect(page.getByText("Solicitação enviada com sucesso")).toBeVisible({
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
    await expect(page.getByText("Solicitante Fluxo Completo")).toBeVisible();
    await expect(page.getByTestId("access-request-status-email")).toContainText(email);
    await expect(page.getByText("Suporte técnico")).toBeVisible();

    await expect(page.getByText("medium")).toHaveCount(0);
    await expect(page.getByText("technical_support")).toHaveCount(0);
  });
});
