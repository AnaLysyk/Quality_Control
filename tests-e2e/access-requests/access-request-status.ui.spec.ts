import { test, expect } from "../fixtures/test";
import {
  buildPublicAccessRequestPayload,
  criarSolicitacaoPublicaViaApi,
} from "../../support/functions/access-requests/access-requests-public.api";
import { criarEmailTeste, limparEmailsCapturados } from "../../support/functions/access-requests/access-requests.email";
import {
  aprovarSolicitacaoViaApiV2,
  recusarSolicitacaoViaApiV2,
  solicitarAjusteViaApiV2,
} from "../../support/functions/access-requests/access-requests-status.api";

async function abrirStatusPorLink(page: import("@playwright/test").Page, accessKey: string) {
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
    throw new Error(`Erro na consulta de status UI: ${await error.textContent()} | API=${response.status()} ${bodyText}`);
  }

  await expect(result).toBeVisible({ timeout: 15000 });
}

test.describe("Solicitações de acesso - consulta/status UI", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve consultar status e mostrar em análise com datas", async ({ page, request }) => {
    const email = criarEmailTeste("status-ui");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Aguardando análise|Em análise/i);
    await expect(page.getByTestId("access-request-created-at")).not.toHaveText("-");
    await expect(page.getByTestId("access-request-updated-at")).not.toHaveText("-");
    await expect(page.getByTestId("access-request-status-message")).toContainText(/e-mail/i);
    await expect(page.getByTestId("access-request-requester-email")).toContainText(email);
  });

  test("deve consultar manualmente por e-mail e token", async ({ page, request }) => {
    const email = criarEmailTeste("status-manual");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-result")).toBeVisible();
    await expect(page.getByTestId("access-request-requester-email")).toContainText(email);
  });

  test("deve mostrar aprovado quando solicitação for aprovada", async ({ page, request }) => {
    const email = criarEmailTeste("status-ui-aprovado");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await aprovarSolicitacaoViaApiV2(request, created.id);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Aprovado/i);
    await expect(page.getByTestId("access-request-status-message")).toContainText(/aprovada/i);
  });

  test("deve mostrar recusado quando solicitação for recusada", async ({ page, request }) => {
    const email = criarEmailTeste("status-ui-recusado");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await recusarSolicitacaoViaApiV2(request, created.id);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Rejeitado|Recusado/i);
    await expect(page.getByTestId("access-request-status-message")).toContainText(/rejeitada|recusada/i);
    await expect(page.getByTestId("access-request-review-comment")).toContainText(/Rejeitado|Recusado/i);
  });

  test("deve mostrar campos de correção quando houver ajuste", async ({ page, request }) => {
    const email = criarEmailTeste("status-ui-ajuste");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await solicitarAjusteViaApiV2(request, created.id);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Ajuste necessário/i);
    await expect(page.getByTestId("access-request-status-message")).toContainText(/Corrija|correção/i);
    await expect(page.getByTestId("access-request-adjustment-fields")).toContainText("Telefone");
    await expect(page.getByTestId("access-request-adjustment-fields")).toContainText("Descrição");
  });
});
