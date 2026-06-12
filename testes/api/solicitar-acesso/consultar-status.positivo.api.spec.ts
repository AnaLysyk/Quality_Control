import { test, expect } from "../../../support/fixtures/test";
import {
  montarPayloadSolicitacaoPublica,
  criarSolicitacaoPublicaViaApi,
} from "../../../support/functions/api/solicitar-acesso/criar-solicitacao-publica";
import { criarEmailTeste, limparEmailsCapturados } from "../../../support/functions/api/solicitar-acesso/capturar-emails";
import {
  aprovarSolicitacaoViaApiV2,
  consultarSolicitacaoComTokenInvalido,
  consultarSolicitacaoPorChaveAcesso,
  recusarSolicitacaoViaApiV2,
  solicitarAjusteViaApiV2,
} from "../../../support/functions/api/solicitar-acesso/consultar-status";
import { autenticarSolicitacaoAcessoViaApi } from "../../../support/functions/api/solicitar-acesso/autenticar-revisor";

test.describe("Solicitações de acesso - consulta/status API", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve consultar solicitação por accessKey e validar status, data e e-mail", async ({ request }) => {
    const email = criarEmailTeste("status-api");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    const item = await consultarSolicitacaoPorChaveAcesso(request, created.accessKey);

    expect(item.status).toMatch(/pending|under_review/);
    expect(item.requesterEmail).toBe(email);
    expect(item.createdAt).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();
  });

  test("deve retornar erro para token inválido", async ({ request }) => {
    await consultarSolicitacaoComTokenInvalido(request);
  });

  test("deve aprovar solicitação e consultar status aprovado", async ({ request }) => {
    await autenticarSolicitacaoAcessoViaApi(request, "leader_tc");
    const email = criarEmailTeste("status-aprovado");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await aprovarSolicitacaoViaApiV2(request, created.id);

    const item = await consultarSolicitacaoPorChaveAcesso(request, created.accessKey);

    expect(item.status).toBe("approved");
    expect(item.reviewComment).toContain("Aprovado");
  });

  test("deve recusar solicitação e consultar status recusado", async ({ request }) => {
    await autenticarSolicitacaoAcessoViaApi(request, "leader_tc");
    const email = criarEmailTeste("status-recusado");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await recusarSolicitacaoViaApiV2(request, created.id);

    const item = await consultarSolicitacaoPorChaveAcesso(request, created.accessKey);

    expect(item.status).toBe("rejected");
    expect(item.reviewComment).toContain("Recusado");
  });

  test("deve solicitar ajuste e consultar status ajuste necessário", async ({ request }) => {
    await autenticarSolicitacaoAcessoViaApi(request, "leader_tc");
    const email = criarEmailTeste("status-ajuste");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await solicitarAjusteViaApiV2(request, created.id);

    const item = await consultarSolicitacaoPorChaveAcesso(request, created.accessKey);

    expect(item.status).toBe("needs_more_info");
    expect(item.adjustmentFields).toEqual(expect.arrayContaining(["phone", "description"]));
    expect(item.reviewComment).toContain("Corrigir");
  });

  test("deve aceitar somente os campos solicitados e registrar o retorno para análise", async ({
    request,
  }) => {
    await autenticarSolicitacaoAcessoViaApi(request, "leader_tc");
    const email = criarEmailTeste("status-ajuste-parcial");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await solicitarAjusteViaApiV2(request, created.id);

    const patchResponse = await request.patch(
      `/api/access-requests/by-key/${encodeURIComponent(created.accessKey)}`,
      {
        data: {
          phone: "+55 11 98888-7777",
          description: "Descrição corrigida e reenviada para nova análise.",
          email: "alteracao-nao-autorizada@example.com",
        },
      },
    );
    const patchBody = await patchResponse.json().catch(() => null);

    expect(patchResponse.status(), JSON.stringify(patchBody)).toBe(200);
    expect(patchBody?.item?.status).toBe("under_review");

    const updated = await consultarSolicitacaoPorChaveAcesso(request, created.accessKey);

    expect(updated.status).toBe("under_review");
    expect(updated.requesterEmail).toBe(email);
    expect(updated.details?.phone).toBe("+55 11 98888-7777");
    expect(updated.details?.description).toBe(
      "Descrição corrigida e reenviada para nova análise.",
    );
    expect(updated.adjustmentFields).toEqual([]);
    expect(updated.lastAdjustmentDiff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "phone" }),
        expect.objectContaining({ field: "description" }),
      ]),
    );
    expect(updated.adjustmentHistory?.at(-1)?.requesterReturnedAt).toBeTruthy();

    const repeatedPatch = await request.patch(
      `/api/access-requests/by-key/${encodeURIComponent(created.accessKey)}`,
      {
        data: {
          phone: "+55 11 97777-6666",
          description: "Nova tentativa indevida.",
        },
      },
    );

    expect(repeatedPatch.status()).toBe(409);
  });
});
