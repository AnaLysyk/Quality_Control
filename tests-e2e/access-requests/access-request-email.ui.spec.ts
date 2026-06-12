import { test, expect } from "../fixtures/test";
import {
  buildPublicAccessRequestPayload,
  criarSolicitacaoPublicaViaApi,
} from "../../support/functions/access-requests/access-requests-public.api";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
  listarEmailsCapturados,
} from "../../support/functions/access-requests/access-requests.email";

test.describe("Solicitações de acesso - ciclo de e-mail UI", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve criar solicitação a partir da tela pública e capturar e-mail com detalhes", async ({ page }) => {
    const email = criarEmailTeste("ui");
    const payload = buildPublicAccessRequestPayload(email);

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
      subject: "Solicitação de acesso recebida - Quality Control",
      contains: [
        payload.full_name,
        payload.email,
        payload.phone,
        payload.title,
        "Em análise",
      ],
    });
  });

  test("deve bloquear duplicidade a partir da tela pública e não gerar novo e-mail", async ({ page }) => {
    const email = criarEmailTeste("ui-duplicado");
    const payload = buildPublicAccessRequestPayload(email);

    await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });

    const firstResponse = await page.request.post("/api/access-requests/public", {
      data: payload,
    });

    const firstBody = await firstResponse.json().catch(() => null);

    expect(firstResponse.status(), JSON.stringify(firstBody)).toBe(201);

    await esperarEmailCapturado({
      to: email,
      subject: "Solicitação de acesso recebida - Quality Control",
    });

    const totalAntes = listarEmailsCapturados().length;

    const duplicateResponse = await page.request.post("/api/access-requests/public", {
      data: payload,
    });

    const duplicateBody = await duplicateResponse.json().catch(() => null);

    expect(duplicateResponse.status(), JSON.stringify(duplicateBody)).toBe(409);
    expect(duplicateBody?.code).toBe("DUPLICATE_ACCESS_REQUEST");
    expect(duplicateBody?.message).toContain("Já existe uma solicitação de acesso aberta ou em análise");

    expect(listarEmailsCapturados()).toHaveLength(totalAntes);
  });

  test("deve solicitar reenvio do código por nome e e-mail", async ({ page, request }) => {
    const email = criarEmailTeste("ui-reenvio");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });
    const openLookupButton = page.getByTestId("open-access-request-lookup-button");
    await expect(openLookupButton).toBeVisible();
    await page.waitForTimeout(1500);
    await openLookupButton.click();
    await expect(page.getByTestId("access-request-lookup-form")).toBeVisible();
    await page.getByTestId("request-access-lookup-name-input").fill(payload.full_name);
    await page.getByTestId("request-access-lookup-email-input").fill(email);
    await page.getByTestId("request-access-lookup-resend-button").click();

    await expect(page.getByTestId("request-access-lookup-resend-notice")).toContainText(
      /código será reenviado/i,
      { timeout: 30000 },
    );
    await expect.poll(() => listarEmailsCapturados().length).toBe(2);

    const resentEmail = listarEmailsCapturados().at(-1);
    expect(`${resentEmail?.text ?? ""}\n${resentEmail?.html ?? ""}`).toContain(
      created.accessKey,
    );
  });
});
