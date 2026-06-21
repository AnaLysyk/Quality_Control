/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/perfis/fluxo-ajustes-recusa.ui.spec.ts --headed --workers=1 --reporter=list
 */
import { expect, test } from "@playwright/test";

import {
  autenticarContextoSolicitacaoAcesso,
  type PerfilTesteSolicitacaoAcesso,
} from "../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  criarEmailTeste,
  limparEmailsCapturados,
} from "../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";
import {
  aprovarSolicitacaoAdministrativa,
  comentarComoRevisor,
  comentarComoSolicitante,
  consultarSolicitacaoPublicaCompleta,
  corrigirCamposSolicitante,
  criarSolicitacaoPublicaComChave,
  montarPayloadSolicitacaoFluxo,
  type PerfilSolicitacaoAcessoPublica,
  recusarSolicitacaoAdministrativa,
  solicitarAjusteAdministrativo,
  validarConversaPublicaContem,
  validarEmailCapturadoQuandoDisponivel,
  validarLoginRecusadoPorApi,
  validarLoginUsuarioAprovadoPorApi,
} from "../../../../../support/functions/api/solicitar-acesso/fluxos/fluxo-ajustes-recusa";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000" });

const perfis: Array<{
  role: PerfilSolicitacaoAcessoPublica;
  label: string;
  reviewer: PerfilTesteSolicitacaoAcesso;
}> = [
  { role: "empresa", label: "Empresa", reviewer: "leader_tc" },
  { role: "testing_company_user", label: "Usuario Testing Company", reviewer: "technical_support" },
  { role: "company_user", label: "Usuario da empresa", reviewer: "leader_tc" },
  { role: "leader_tc", label: "Lider TC", reviewer: "leader_tc" },
  { role: "technical_support", label: "Suporte tecnico", reviewer: "leader_tc" },
];

const rodadasAjuste = [
  {
    campos: ["phone"],
    dados: { phone: "+55 51 98888-1001" },
  },
  {
    campos: ["description"],
    dados: { description: "Descricao corrigida na segunda rodada de ajuste." },
  },
  {
    campos: ["jobRole"],
    dados: { jobRole: "Analista de QA corrigido" },
  },
];

test.describe("Solicitacao de acesso - ajustes, conversa, aprovacao e recusa por perfil", () => {
  test.setTimeout(600000);

  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  for (const perfil of perfis) {
    test(`${perfil.label} deve passar por 3 ajustes, conversa, aprovacao e login`, async ({ browser }) => {
      const reviewerContext = await browser.newContext();
      const approvedContext = await browser.newContext();

      try {
        await autenticarContextoSolicitacaoAcesso(reviewerContext, perfil.reviewer);
        const request = reviewerContext.request;

        const email = criarEmailTeste(`ajustes-aprovacao-${perfil.role}`);
        const payload = montarPayloadSolicitacaoFluxo(email, {
          requestedRole: perfil.role,
          requestedCompanyId: perfil.role === "company_user" ? "cmp_demo" : undefined,
          requestedCompanySlug: perfil.role === "company_user" ? "Testing Company E2E" : undefined,
        });
        const created = await criarSolicitacaoPublicaComChave(request, payload);

        await validarEmailCapturadoQuandoDisponivel({
          to: email,
          subject: /Solicita.*acesso recebida - Quality Control/i,
          contains: [email],
          label: "E-mail de solicitacao recebida",
        });

        const pendente = await consultarSolicitacaoPublicaCompleta(request, created.accessKey);
        expect(pendente.item?.status).toBe("pending");
        expect(pendente.item?.requesterEmail).toBe(email);

        const conversaEsperada: string[] = [];

        for (let index = 0; index < rodadasAjuste.length; index += 1) {
          const rodada = index + 1;
          const ajuste = rodadasAjuste[index]!;
          const comentarioRevisor = `Rodada ${rodada} - ajuste solicitado pelo revisor para ${perfil.label}.`;
          const comentarioSolicitante = `Rodada ${rodada} - solicitante corrigiu os dados e respondeu na conversa.`;

          await comentarComoRevisor(
            request,
            created.id,
            `Comentario em tempo real antes do ajuste ${rodada} para ${perfil.label}.`,
          );
          conversaEsperada.push(`Comentario em tempo real antes do ajuste ${rodada}`);

          await solicitarAjusteAdministrativo(request, {
            id: created.id,
            rodada,
            campos: ajuste.campos,
            comentario: comentarioRevisor,
          });
          conversaEsperada.push(comentarioRevisor);

          const needsInfo = await consultarSolicitacaoPublicaCompleta(request, created.accessKey);
          expect(needsInfo.item?.status).toBe("needs_more_info");
          expect(needsInfo.item?.adjustmentFields).toEqual(expect.arrayContaining(ajuste.campos));

          await validarEmailCapturadoQuandoDisponivel({
            to: email,
            subject: /Ajuste necess.rio na sua solicita..o - Quality Control/i,
            contains: [created.accessKey],
            label: `E-mail de ajuste rodada ${rodada}`,
          });

          await comentarComoSolicitante(request, {
            accessKey: created.accessKey,
            nome: payload.requesterName,
            email,
            comentario: comentarioSolicitante,
          });
          conversaEsperada.push(comentarioSolicitante);

          await corrigirCamposSolicitante(request, created.accessKey, ajuste.dados);
          const underReview = await consultarSolicitacaoPublicaCompleta(request, created.accessKey);
          expect(underReview.item?.status).toBe("under_review");
          await validarConversaPublicaContem(request, created.accessKey, conversaEsperada);
        }

        const aprovado = await aprovarSolicitacaoAdministrativa(request, {
          id: created.id,
          comentario: `Aprovado apos tres rodadas com conversa validada para ${perfil.label}.`,
        });

        const statusAprovado = await consultarSolicitacaoPublicaCompleta(request, created.accessKey);
        expect(statusAprovado.item?.status).toBe("approved");

        await validarEmailCapturadoQuandoDisponivel({
          to: email,
          subject: /aprovad|bem-vindo|acesso/i,
          contains: [email],
          label: "E-mail de aprovacao/acesso aceito",
        });

        await validarLoginUsuarioAprovadoPorApi(approvedContext.request, {
          username: aprovado.username,
          email,
          senha: payload.password,
          perfil: perfil.role,
        });
      } finally {
        await reviewerContext.close();
        await approvedContext.close();
      }
    });

    test(`${perfil.label} deve recusar solicitacao, enviar e-mail e bloquear login`, async ({ browser }) => {
      const reviewerContext = await browser.newContext();
      const rejectedContext = await browser.newContext();

      try {
        await autenticarContextoSolicitacaoAcesso(reviewerContext, "leader_tc");
        const request = reviewerContext.request;
        const email = criarEmailTeste(`recusa-${perfil.role}`);
        const payload = montarPayloadSolicitacaoFluxo(email, {
          requestedRole: perfil.role,
          requestedCompanyId: perfil.role === "company_user" ? "cmp_demo" : undefined,
          requestedCompanySlug: perfil.role === "company_user" ? "Testing Company E2E" : undefined,
        });
        const created = await criarSolicitacaoPublicaComChave(request, payload);
        const motivo = `Recusa automatizada para validar bloqueio de acesso ${perfil.label}.`;

        await comentarComoRevisor(
          request,
          created.id,
          `Comentario em tempo real antes da recusa para ${perfil.label}.`,
        );
        await recusarSolicitacaoAdministrativa(request, {
          id: created.id,
          motivo,
        });

        const statusRecusado = await consultarSolicitacaoPublicaCompleta(request, created.accessKey);
        expect(statusRecusado.item?.status).toBe("rejected");
        expect(statusRecusado.item?.reviewComment).toContain("Recusa automatizada");

        await validarEmailCapturadoQuandoDisponivel({
          to: email,
          subject: /rejeitad|recusad/i,
          contains: [motivo],
          label: "E-mail de solicitacao recusada",
        });

        await validarLoginRecusadoPorApi(rejectedContext.request, payload);
      } finally {
        await reviewerContext.close();
        await rejectedContext.close();
      }
    });
  }
});
