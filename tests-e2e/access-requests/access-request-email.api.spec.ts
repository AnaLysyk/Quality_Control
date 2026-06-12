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
      subject: /Solicita.*acesso recebida - Quality Control/i,
      contains: [
        payload.full_name,
        payload.email,
        payload.phone,
        "Quality Control",
        "Perfil solicitado",
      ],
    });
  });

  test("não deve criar nova solicitação duplicada nem gerar novo e-mail", async ({ request }) => {
    const email = criarEmailTeste("api-duplicado");
    const payload = buildPublicAccessRequestPayload(email);

    await criarSolicitacaoPublicaViaApi(request, payload);
    await esperarEmailCapturado({
      to: email,
      subject: /Solicita.*acesso recebida - Quality Control/i,
    });

    const totalAntes = listarEmailsCapturados().length;

    await tentarCriarSolicitacaoPublicaDuplicadaViaApi(request, payload);

    expect(listarEmailsCapturados()).toHaveLength(totalAntes);
  });

  test("deve reenviar o mesmo código somente por e-mail e responder de forma neutra", async ({
    request,
  }) => {
    const email = criarEmailTeste("api-reenvio");
    const payload = buildPublicAccessRequestPayload(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    const resendResponse = await request.post("/api/support/access-request/lookup", {
      data: { name: payload.full_name, email },
    });
    const resendBody = await resendResponse.json();

    expect(resendResponse.status()).toBe(200);
    expect(resendBody.ok).toBeTruthy();
    expect(resendBody.accessKey).toBeUndefined();

    await expect.poll(() => listarEmailsCapturados().length).toBe(2);
    const resentEmail = listarEmailsCapturados().at(-1);
    const resentContent = `${resentEmail?.text ?? ""}\n${resentEmail?.html ?? ""}`;

    expect(resentContent).toContain(created.accessKey);

    const totalBeforeUnknown = listarEmailsCapturados().length;
    const unknownResponse = await request.post("/api/support/access-request/lookup", {
      data: { name: "Pessoa inexistente", email: criarEmailTeste("desconhecido") },
    });
    const unknownBody = await unknownResponse.json();

    expect(unknownResponse.status()).toBe(200);
    expect(unknownBody.ok).toBeTruthy();
    expect(unknownBody.accessKey).toBeUndefined();
    expect(listarEmailsCapturados()).toHaveLength(totalBeforeUnknown);
  });
});
