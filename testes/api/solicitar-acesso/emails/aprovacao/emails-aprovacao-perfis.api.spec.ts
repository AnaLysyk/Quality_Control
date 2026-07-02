/**
 * Rodar:
 * npx playwright test testes/api/solicitar-acesso/emails-aprovacao-perfis.api.spec.ts --project=chromium
 */
import { test, expect, APIRequestContext } from "@playwright/test";
import { autenticarContextoSolicitacaoAcesso } from "../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  criarSolicitacaoPublicaViaApi,
  montarPayloadSolicitacaoPublica,
  PerfilSolicitacaoAcessoPublica,
} from "../../../../../support/functions/api/solicitar-acesso/formulario/criar-solicitacao-publica";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";
import { perfisAutorizadosSolicitacoes } from "../../../../../support/functions/banco-de-dados/solicitar-acesso/perfis/definir-perfis-teste";
import {
  aprovarSolicitacaoViaApiV2,
  consultarSolicitacaoPorChaveAcesso,
} from "../../../../../support/functions/api/solicitar-acesso/consulta/consultar-status";

type PerfilEmailAprovado = {
  role: PerfilSolicitacaoAcessoPublica;
  title: string;
  badge: string;
  label: string;
  needsCompany?: boolean;
};

const perfisEmailAprovado: PerfilEmailAprovado[] = [
  {
    role: "empresa",
    title: "Solicitação de acesso empresarial aprovada",
    badge: "Empresa aprovada",
    label: "Empresa",
  },
  {
    role: "company_user",
    title: "Solicitação de acesso como usuário da empresa aprovada",
    badge: "Usuário da empresa aprovado",
    label: "Usuário da empresa",
    needsCompany: true,
  },
  {
    role: "testing_company_user",
    title: "Solicitação de acesso como usuário TC aprovada",
    badge: "Usuário TC aprovado",
    label: "Usuário TC",
  },
  {
    role: "leader_tc",
    title: "Solicitação de acesso como líder TC aprovada",
    badge: "Líder TC aprovado",
    label: "Líder TC",
  },
  {
    role: "technical_support",
    title: "Solicitação de acesso como suporte técnico aprovada",
    badge: "Suporte técnico aprovado",
    label: "Suporte técnico",
  },
];

async function obterEmpresaParaVinculo(request: APIRequestContext) {
  const response = await request.get("/api/admin/clients");
  const body = await response.json().catch(() => null);

  const candidates = Array.isArray(body)
    ? body
    : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.clients)
        ? body.clients
        : Array.isArray(body?.data)
          ? body.data
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

test.describe("E-mails de aprovação por perfil solicitado", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  const reviewer = perfisAutorizadosSolicitacoes.find((item) => item.role === "leader_tc") ??
    perfisAutorizadosSolicitacoes[0];

  for (const perfil of perfisEmailAprovado) {
    test(`deve enviar e-mail aprovado para ${perfil.label}`, async ({ browser }) => {
      const reviewerContext = await browser.newContext();
      const approvedUserContext = await browser.newContext();

      try {
        await autenticarContextoSolicitacaoAcesso(reviewerContext, reviewer.role);
        const request = reviewerContext.request;

        const company = perfil.needsCompany
          ? await obterEmpresaParaVinculo(request)
          : undefined;

        const email = criarEmailTeste(`approval-${perfil.role}`);
        const payload = montarPayloadSolicitacaoPublica(email, {
          requestedRole: perfil.role,
          requestedCompanyId: company?.id,
          requestedCompanySlug: company?.slug,
        });

        const created = await criarSolicitacaoPublicaViaApi(request, payload);
        await aprovarSolicitacaoViaApiV2(request, created.id);

        const publicItem = await consultarSolicitacaoPorChaveAcesso(
          request,
          created.accessKey,
        );

        expect(publicItem.status).toBe("approved");

        const approvalEmail = await esperarEmailCapturado({
          to: email,
          subject: new RegExp(`${perfil.title} - Quality Control`, "i"),
          contains: [
            perfil.title,
            perfil.badge,
            "Login cadastrado",
            "Senha cadastrada",
            payload.password,
            "Altere sua senha após o primeiro acesso",
          ],
        });

        const content = `${approvalEmail.subject}\n${approvalEmail.text ?? ""}\n${approvalEmail.html}`;
        expect(content).not.toContain("Acesso Testing Company");
        expect(content).not.toContain("Usuário Testing Company");
        if (perfil.role === "testing_company_user") {
          expect(content).not.toContain("Empresa vinculada:");
          expect(content).not.toContain("Testing Company");
        }

        const loginResponse = await approvedUserContext.request.post("/api/auth/login", {
          data: {
            user: email,
            password: payload.password,
          },
        });

        expect(loginResponse.status(), await loginResponse.text()).toBe(200);

        const meResponse = await approvedUserContext.request.get("/api/me");
        const me = await meResponse.json().catch(() => null);

        expect(meResponse.status(), JSON.stringify(me)).toBe(200);
        expect(me?.user?.email).toBe(email);
      } finally {
        await reviewerContext.close();
        await approvedUserContext.close();
      }
    });
  }
});


