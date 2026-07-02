/**
 * Rodar:
 * npx playwright test testes/api/solicitar-acesso/emails-rejeicao-perfis.api.spec.ts --project=chromium
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { autenticarContextoSolicitacaoAcesso } from "../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  criarSolicitacaoPublicaViaApi,
  montarPayloadSolicitacaoPublica,
} from "../../../../../support/functions/api/solicitar-acesso/formulario/criar-solicitacao-publica";
import type { PerfilSolicitacaoAcessoPublica } from "../../../../../support/functions/api/solicitar-acesso/formulario/criar-solicitacao-publica";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";
import {
  consultarSolicitacaoPorChaveAcesso,
  recusarSolicitacaoViaApiV2,
} from "../../../../../support/functions/api/solicitar-acesso/consulta/consultar-status";
import { perfisAutorizadosSolicitacoes } from "../../../../../support/functions/banco-de-dados/solicitar-acesso/perfis/definir-perfis-teste";
import { validarSolicitacaoNaFila } from "../../../../../support/functions/api/solicitar-acesso/solicitacoes/validar-fila-solicitacoes";

type PerfilRejeicao = {
  role: PerfilSolicitacaoAcessoPublica;
  label: string;
  emailPrefix: string;
  needsCompany?: boolean;
};

const perfis: PerfilRejeicao[] = [
  { role: "empresa", label: "Empresa", emailPrefix: "rejection-empresa" },
  {
    role: "company_user",
    label: "Usuário da empresa",
    emailPrefix: "rejection-company-user",
    needsCompany: true,
  },
  {
    role: "testing_company_user",
    label: "Usuário TC",
    emailPrefix: "rejection-usuario-tc",
  },
  { role: "leader_tc", label: "Líder TC", emailPrefix: "rejection-lider-tc" },
  {
    role: "technical_support",
    label: "Suporte técnico",
    emailPrefix: "rejection-technical-support",
  },
];

async function obterEmpresaParaVinculo(request: APIRequestContext) {
  const response = await request.get("/api/admin/clients");
  const body = await response.json().catch(() => null);

  const candidates = Array.isArray(body)
    ? body
    : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.clients)
          ? body.clients
          : [];

  const company = candidates.find((item: any) => item?.id || item?.slug || item?.client_id);

  if (!company) {
    return {
      id: "cmp_e2e_testing_company",
      slug: "empresa-e2e-testing-company",
    };
  }

  return {
    id: String(company.id ?? company.client_id ?? company.slug),
    slug: company.slug ? String(company.slug) : "empresa-e2e-testing-company",
  };
}

test.describe("E-mails de rejeição por perfil solicitado", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  const reviewer = perfisAutorizadosSolicitacoes.find((item) => item.role === "leader_tc")
    ?? perfisAutorizadosSolicitacoes[0];

  for (const perfil of perfis) {
    test(`deve enviar e-mail rejeitado para ${perfil.label}`, async ({ browser }) => {
      const reviewerContext = await browser.newContext();
      const rejectedUserContext = await browser.newContext();

      try {
        await autenticarContextoSolicitacaoAcesso(reviewerContext, reviewer.role);

        const request = reviewerContext.request;
        const email = criarEmailTeste(perfil.emailPrefix);
        const company = perfil.needsCompany ? await obterEmpresaParaVinculo(request) : null;

        const payload = montarPayloadSolicitacaoPublica(email, {
          requestedRole: perfil.role,
          requestedCompanyId: company?.id,
          requestedCompanySlug: company?.slug,
        });

        const created = await criarSolicitacaoPublicaViaApi(request, payload);

        await validarSolicitacaoNaFila(request, created.id);
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
          contains: [
            "Sua solicitação de acesso foi rejeitada",
            "Motivo informado",
            "Recusado por dados incompatíveis",
          ],
        });

        const content = `${rejectionEmail.subject}\n${rejectionEmail.text ?? ""}\n${rejectionEmail.html}`;

        expect(content).toContain(created.accessKey);
        expect(content).not.toContain(payload.password);
        expect(content).not.toContain("Senha cadastrada");
        expect(content).not.toContain("Login cadastrado");
        expect(content).not.toContain("Acessar o sistema");
        expect(content).not.toContain("Testing Company");

        const loginResponse = await rejectedUserContext.request.post("/api/auth/login", {
          data: {
            user: email,
            password: payload.password,
          },
        });

        expect(loginResponse.status()).not.toBe(200);
      } finally {
        await rejectedUserContext.close();
        await reviewerContext.close();
      }
    });
  }
});


