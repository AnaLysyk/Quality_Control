import { test, expect } from "../fixtures/test";
import {
  buildPublicAccessRequestPayload,
  criarSolicitacaoPublicaViaApi,
} from "../../support/functions/access-requests/access-requests-public.api";
import { criarEmailTeste, limparEmailsCapturados } from "../../support/functions/access-requests/access-requests.email";
import {
  aprovarSolicitacaoViaApiV2,
  consultarSolicitacaoComTokenInvalido,
  consultarSolicitacaoPorAccessKey,
  recusarSolicitacaoViaApiV2,
  solicitarAjusteViaApiV2,
} from "../../support/functions/access-requests/access-requests-status.api";

test.describe("Solicitações de acesso - consulta/status API", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve consultar solicitação por accessKey e validar status, data e e-mail", async ({ request }) => {
    const email = criarEmailTeste("status-api");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    const item = await consultarSolicitacaoPorAccessKey(request, created.accessKey);

    expect(item.status).toMatch(/pending|under_review/);
    expect(item.requesterEmail).toBe(email);
    expect(item.createdAt).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();
  });

  test("deve retornar erro para token inválido", async ({ request }) => {
    await consultarSolicitacaoComTokenInvalido(request);
  });

  test("deve aprovar solicitação e consultar status aprovado", async ({ request }) => {
    const email = criarEmailTeste("status-aprovado");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await aprovarSolicitacaoViaApiV2(request, created.id);

    const item = await consultarSolicitacaoPorAccessKey(request, created.accessKey);

    expect(item.status).toBe("approved");
    expect(item.reviewComment).toContain("Aprovado");
  });

  test("deve recusar solicitação e consultar status recusado", async ({ request }) => {
    const email = criarEmailTeste("status-recusado");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await recusarSolicitacaoViaApiV2(request, created.id);

    const item = await consultarSolicitacaoPorAccessKey(request, created.accessKey);

    expect(item.status).toBe("rejected");
    expect(item.reviewComment).toContain("Recusado");
  });

  test("deve solicitar ajuste e consultar status ajuste necessário", async ({ request }) => {
    const email = criarEmailTeste("status-ajuste");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await solicitarAjusteViaApiV2(request, created.id);

    const item = await consultarSolicitacaoPorAccessKey(request, created.accessKey);

    expect(item.status).toBe("needs_more_info");
    expect(item.adjustmentFields).toEqual(expect.arrayContaining(["phone", "description"]));
    expect(item.reviewComment).toContain("Corrigir");
  });
});
