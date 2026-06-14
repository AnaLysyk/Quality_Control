import { expect, test } from "../../../support/fixtures/test";
import { autenticarContextoSolicitacaoAcesso } from "../../../support/functions/api/solicitar-acesso/autenticar-revisor";
import {
  montarPayloadSolicitacaoPublica,
  criarSolicitacaoPublicaViaApi,
} from "../../../support/functions/api/solicitar-acesso/criar-solicitacao-publica";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../support/functions/api/solicitar-acesso/capturar-emails";
import { perfisAutorizadosSolicitacoes } from "../../../support/functions/banco-de-dados/solicitar-acesso/definir-perfis-teste";
import {
  aprovarSolicitacaoViaApiV2,
  consultarSolicitacaoPorChaveAcesso,
  recusarSolicitacaoViaApiV2,
  solicitarAjusteViaApiV2,
} from "../../../support/functions/api/solicitar-acesso/consultar-status";
import { validarSolicitacaoNaFila } from "../../../support/functions/api/solicitar-acesso/validar-fila-solicitacoes";

test.describe("Solicitacoes de acesso - ciclos por perfil revisor", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  for (const reviewer of perfisAutorizadosSolicitacoes) {
    test(`${reviewer.label} deve aprovar, enviar e-mail e liberar login`, async ({ browser }) => {
      const reviewerContext = await browser.newContext();
      const approvedUserContext = await browser.newContext();

      try {
        await autenticarContextoSolicitacaoAcesso(reviewerContext, reviewer.role);
        const request = reviewerContext.request;
        const email = criarEmailTeste(`approval-${reviewer.role}`);
        const payload = montarPayloadSolicitacaoPublica(email);
        const created = await criarSolicitacaoPublicaViaApi(request, payload);

        await validarSolicitacaoNaFila(request, created.id);
        await aprovarSolicitacaoViaApiV2(request, created.id);

        const publicItem = await consultarSolicitacaoPorChaveAcesso(
          request,
          created.accessKey,
        );
        expect(publicItem.status).toBe("approved");
        expect(publicItem.reviewComment).toContain("Aprovado");

        const approvalEmail = await esperarEmailCapturado({
          to: email,
          subject: /aprovad[ao]|aprovada|aprovado/i,
          contains: ["Login cadastrado", "Senha cadastrada", "Suporte técnico"],
        });
        expect(`${approvalEmail.text ?? ""}\n${approvalEmail.html}`).toContain(
          payload.password,
        );

        const loginResponse = await approvedUserContext.request.post(
          "/api/auth/login",
          {
            data: {
              user: email,
              password: payload.password,
            },
          },
        );
        expect(loginResponse.status(), await loginResponse.text()).toBe(200);

        const meResponse = await approvedUserContext.request.get("/api/me");
        const me = await meResponse.json().catch(() => null);
        expect(meResponse.status(), JSON.stringify(me)).toBe(200);
        expect(me?.user?.role).toBe("technical_support");
        expect(me?.user?.email).toBe(email);
      } finally {
        await reviewerContext.close();
        await approvedUserContext.close();
      }
    });

    test(`${reviewer.label} deve solicitar ajuste e receber dados corrigidos`, async ({
      browser,
    }) => {
      const context = await browser.newContext();

      try {
        await autenticarContextoSolicitacaoAcesso(context, reviewer.role);
        const request = context.request;
        const email = criarEmailTeste(`adjustment-${reviewer.role}`);
        const payload = montarPayloadSolicitacaoPublica(email);
        const created = await criarSolicitacaoPublicaViaApi(request, payload);

        await solicitarAjusteViaApiV2(request, created.id);

        const adjustmentEmail = await esperarEmailCapturado({
          to: email,
          subject: /Ajuste necess.rio na sua solicita..o - Quality Control/i,
          contains: ["Telefone", "Descrição", created.accessKey],
        });
        expect(`${adjustmentEmail.text ?? ""}\n${adjustmentEmail.html}`).not.toContain(
          payload.password,
        );

        const needsInfo = await consultarSolicitacaoPorChaveAcesso(
          request,
          created.accessKey,
        );
        expect(needsInfo.status).toBe("needs_more_info");
        expect(needsInfo.adjustmentFields).toEqual(
          expect.arrayContaining(["phone", "description"]),
        );

        const patchResponse = await request.patch(
          `/api/access-requests/by-key/${encodeURIComponent(created.accessKey)}`,
          {
            data: {
              phone: "+55 11 98888-7777",
              description: "Dados corrigidos e reenviados para nova analise.",
              email: "campo-nao-solicitado@quality-control.test",
            },
          },
        );
        const patchBody = await patchResponse.json().catch(() => null);
        expect(patchResponse.status(), JSON.stringify(patchBody)).toBe(200);
        expect(patchBody?.item?.status).toBe("under_review");

        const publicItem = await consultarSolicitacaoPorChaveAcesso(
          request,
          created.accessKey,
        );
        expect(publicItem.requesterEmail).toBe(email);
        expect(publicItem.details?.phone).toBe("+55 11 98888-7777");
        expect(publicItem.details?.description).toBe(
          "Dados corrigidos e reenviados para nova analise.",
        );

        const reviewerResponse = await request.get(
          `/api/access-requests/${created.id}`,
        );
        const reviewerBody = await reviewerResponse.json().catch(() => null);
        expect(reviewerResponse.status(), JSON.stringify(reviewerBody)).toBe(200);
        expect(reviewerBody?.item?.status).toBe("under_review");
        expect(reviewerBody?.item?.details?.phone).toBe("+55 11 98888-7777");
      } finally {
        await context.close();
      }
    });

    test(`${reviewer.label} deve recusar com motivo e enviar e-mail`, async ({ browser }) => {
      const context = await browser.newContext();

      try {
        await autenticarContextoSolicitacaoAcesso(context, reviewer.role);
        const request = context.request;
        const email = criarEmailTeste(`rejection-${reviewer.role}`);
        const payload = montarPayloadSolicitacaoPublica(email);
        const created = await criarSolicitacaoPublicaViaApi(request, payload);

        await recusarSolicitacaoViaApiV2(request, created.id);

        const publicItem = await consultarSolicitacaoPorChaveAcesso(
          request,
          created.accessKey,
        );
        expect(publicItem.status).toBe("rejected");
        expect(publicItem.reviewComment).toContain("Recusado");

        const rejectionEmail = await esperarEmailCapturado({
          to: email,
          subject: /Solicita..o de acesso rejeitada - Quality Control/i,
          contains: ["Recusado por dados incompatíveis", created.accessKey],
        });
        expect(`${rejectionEmail.text ?? ""}\n${rejectionEmail.html}`).not.toContain(
          payload.password,
        );
      } finally {
        await context.close();
      }
    });
  }
});


