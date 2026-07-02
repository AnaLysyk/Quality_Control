/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/email/capturar-e-reenviar-email-solicitacao.ui.spec.ts --project=chromium
 */
import { test, expect } from "../../../../../../support/fixtures/test";
import {
  montarPayloadSolicitacaoPublica,
  criarSolicitacaoPublicaViaApi,
} from "../../../../../../support/functions/api/solicitar-acesso/formulario/criar-solicitacao-publica";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
  listarEmailsCapturados,
} from "../../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";

test.describe("SolicitaÃ§Ãµes de acesso - ciclo de e-mail UI", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve criar solicitaÃ§Ã£o a partir da tela pÃºblica e capturar e-mail com detalhes", async ({ page }) => {
    const email = criarEmailTeste("ui");
    const payload = montarPayloadSolicitacaoPublica(email);

    await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });

    const response = await page.request.post("/api/access-requests/public", {
      data: payload,
    });

    const body = await response.json().catch(() => null);

    expect(response.status(), JSON.stringify(body)).toBe(201);
    expect(body?.item?.id).toBeTruthy();
    expect(body?.item?.requesterEmail).toBe(email);

    await esperarEmailCapturado({
      to: email,
      subject: "SolicitaÃ§Ã£o de acesso recebida - Quality Control",
      contains: [
        payload.full_name,
        payload.email,
        payload.phone,
        payload.title,
        "Em anÃ¡lise",
      ],
    });
  });

  test("deve bloquear duplicidade a partir da tela pÃºblica e nÃ£o gerar novo e-mail", async ({ page }) => {
    const email = criarEmailTeste("ui-duplicado");
    const payload = montarPayloadSolicitacaoPublica(email);

    await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });

    const firstResponse = await page.request.post("/api/access-requests/public", {
      data: payload,
    });

    const firstBody = await firstResponse.json().catch(() => null);

    expect(firstResponse.status(), JSON.stringify(firstBody)).toBe(201);

    await esperarEmailCapturado({
      to: email,
      subject: "SolicitaÃ§Ã£o de acesso recebida - Quality Control",
    });

    const totalAntes = listarEmailsCapturados().length;

    const duplicateResponse = await page.request.post("/api/access-requests/public", {
      data: payload,
    });

    const duplicateBody = await duplicateResponse.json().catch(() => null);

    expect(duplicateResponse.status(), JSON.stringify(duplicateBody)).toBe(409);
    expect(duplicateBody?.code).toBe("DUPLICATE_ACCESS_REQUEST");
    expect(duplicateBody?.message).toContain("JÃ¡ existe uma solicitaÃ§Ã£o de acesso aberta ou em anÃ¡lise");

    expect(listarEmailsCapturados()).toHaveLength(totalAntes);
  });

  test("deve solicitar reenvio do cÃ³digo por nome e e-mail", async ({ page, request }) => {
    const email = criarEmailTeste("ui-reenvio");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });
    const openLookupButton = page.getByTestId("open-access-request-lookup-button");
    await expect(openLookupButton).toBeVisible();
    await expect
      .poll(
        () =>
          openLookupButton.evaluate((element) => {
            const propsKey = Object.keys(element).find((key) =>
              key.startsWith("__reactProps$"),
            );
            const props = propsKey
              ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey]
              : null;
            return typeof props?.onClick === "function";
          }),
        {
          message: "Esperando a tela publica concluir a hidratacao.",
          timeout: 30000,
        },
      )
      .toBe(true);
    await openLookupButton.click();
    await expect(page.getByTestId("access-request-lookup-form")).toBeVisible();
    await page.getByTestId("request-access-lookup-name-input").fill(payload.full_name);
    await page.getByTestId("request-access-lookup-email-input").fill(email);
    await page.getByTestId("request-access-lookup-resend-button").click();

    await expect(page.getByTestId("request-access-lookup-resend-notice")).toContainText(
      /cÃ³digo serÃ¡ reenviado/i,
      { timeout: 30000 },
    );
    await expect.poll(() => listarEmailsCapturados().length).toBe(2);

    const resentEmail = listarEmailsCapturados().at(-1);
    expect(`${resentEmail?.text ?? ""}\n${resentEmail?.html ?? ""}`).toContain(
      created.accessKey,
    );
  });
});


