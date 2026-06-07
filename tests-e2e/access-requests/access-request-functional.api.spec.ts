import { test } from "../fixtures/test";
import {
  aprovarSolicitacaoViaApi,
  criarSolicitacaoDeAcessoViaApi,
  rejeitarSolicitacaoViaApi,
  solicitarAjusteSolicitacaoViaApi,
} from "../../support/functions/access-requests/access-requests.api";

test.describe("Solicitações de acesso - fluxo funcional API", () => {
  test("deve criar solicitação e solicitar ajuste", async ({ request }) => {
    const created = await criarSolicitacaoDeAcessoViaApi(request);
    await solicitarAjusteSolicitacaoViaApi(request, created.id);
  });

  test("deve criar solicitação e rejeitar com comentário", async ({ request }) => {
    const created = await criarSolicitacaoDeAcessoViaApi(request);
    await rejeitarSolicitacaoViaApi(request, created.id);
  });

  test("deve criar solicitação e aprovar acesso", async ({ request }) => {
    const created = await criarSolicitacaoDeAcessoViaApi(request);
    await aprovarSolicitacaoViaApi(request, created);
  });
});
