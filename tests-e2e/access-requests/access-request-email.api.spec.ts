import { test, expect } from "../fixtures/test";
import {
  buildPublicAccessRequestPayload,
  criarSolicitacaoPublicaViaApi,
  tentarCriarSolicitacaoPublicaDuplicadaViaApi,
} from "../../support/functions/access-requests/access-requests-public.api";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
  listarEmailsCapturados,
} from "../../support/functions/access-requests/access-requests.email";

test.describe("Solicitações de acesso - ciclo de e-mail API", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve criar solicitação pública e capturar e-mail de recebimento com detalhes", async ({ request }) => {
    const email = criarEmailTeste("api");
    const payload = buildPublicAccessRequestPayload(email);

    await criarSolicitacaoPublicaViaApi(request, payload);

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

  test("não deve criar nova solicitação duplicada nem gerar novo e-mail", async ({ request }) => {
    const email = criarEmailTeste("api-duplicado");
    const payload = buildPublicAccessRequestPayload(email);

    await criarSolicitacaoPublicaViaApi(request, payload);
    await esperarEmailCapturado({
      to: email,
      subject: "Solicitação de acesso recebida - Quality Control",
    });

    const totalAntes = listarEmailsCapturados().length;

    await tentarCriarSolicitacaoPublicaDuplicadaViaApi(request, payload);

    expect(listarEmailsCapturados()).toHaveLength(totalAntes);
  });
});
