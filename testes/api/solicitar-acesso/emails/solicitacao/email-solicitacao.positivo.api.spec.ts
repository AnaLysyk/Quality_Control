/**
 * Rodar:
 * npx playwright test testes/api/solicitar-acesso/email-solicitacao.positivo.api.spec.ts --project=chromium
 */
import { test, expect } from "../../../../../support/fixtures/test";
import {
  montarPayloadSolicitacaoPublica,
  criarSolicitacaoPublicaViaApi,
  tentarCriarSolicitacaoPublicaDuplicadaViaApi,
} from "../../../../../support/functions/api/solicitar-acesso/formulario/criar-solicitacao-publica";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
  listarEmailsCapturados,
} from "../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";

test.describe("Solicitações de acesso - ciclo de e-mail API", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve criar solicitação pública e capturar e-mail de recebimento com detalhes", async ({ request }) => {
    const email = criarEmailTeste("api");
    const payload = montarPayloadSolicitacaoPublica(email);

    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    const captured = await esperarEmailCapturado({
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

    const content = `${captured.html}\n${captured.text ?? ""}`;

    expect(content).toContain(created.accessKey);
    expect(content).toContain("/login/access-request");
    expect(content).toContain("nome, e-mail e código");
    expect(content).not.toContain("/login/access-request/status?key=");
  });

  test("deve concluir o envio do e-mail inicial para Líder TC", async ({ request }) => {
    const email = criarEmailTeste("lider-tc");
    const payload = montarPayloadSolicitacaoPublica(email);
    payload.requestType = "leader_tc";
    payload.requestedRole = "leader_tc";
    payload.profile_type = "leader_tc";

    await criarSolicitacaoPublicaViaApi(request, payload);

    await esperarEmailCapturado({
      to: email,
      subject: /Solicita.*acesso recebida - Quality Control/i,
      contains: [payload.full_name, "Líder TC", "Em análise"],
    });
  });

  test("deve identificar pessoa e empresa sem exibir o rótulo genérico ao usuário empresarial", async ({
    request,
  }) => {
    const email = criarEmailTeste("pessoa-empresa");
    const payload = montarPayloadSolicitacaoPublica(email);
    payload.requestType = "company_user";
    payload.requestedRole = "company_user";
    payload.profile_type = "company_user";
    payload.requestedCompanyId = "cmp_e2e_testing_company";
    payload.requestedCompanySlug = "Testing Company E2E";
    payload.company = "Testing Company E2E";
    payload.client_id = "cmp_e2e_testing_company";

    await criarSolicitacaoPublicaViaApi(request, payload);

    const captured = await esperarEmailCapturado({
      to: email,
      subject: /Solicita.*acesso recebida - Quality Control/i,
      contains: [
        payload.full_name,
        "TESTING COMPANY E2E",
        "Pessoa / empresa",
        "Acesso vinculado à Testing Company E2E",
      ],
    });

    expect(`${captured.html}\n${captured.text ?? ""}`).not.toContain(">Usuário da empresa<");
  });

  test("não deve criar nova solicitação duplicada nem gerar novo e-mail", async ({ request }) => {
    const email = criarEmailTeste("api-duplicado");
    const payload = montarPayloadSolicitacaoPublica(email);

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
    const payload = montarPayloadSolicitacaoPublica(email);
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

