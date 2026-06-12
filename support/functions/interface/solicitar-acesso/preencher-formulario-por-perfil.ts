import { expect, type Page } from "@playwright/test";
import {
  abrirFormularioSolicitacaoPublica,
  selecionarCargoAnalista,
} from "./preencher-formulario-publico";

export type PerfilSolicitacao = {
  value: string;
  labelTelaStatus: string;
  perfilEsperadoNoStatus?: string;
  precisaUsuario: boolean;
  precisaEmpresaCadastrada: boolean;
  precisaDadosEmpresa: boolean;
};

export const perfisSolicitacao: PerfilSolicitacao[] = [
  {
    value: "empresa",
    labelTelaStatus: "Empresa",
    precisaUsuario: false,
    precisaEmpresaCadastrada: false,
    precisaDadosEmpresa: true,
  },
  {
    value: "testing_company_user",
    labelTelaStatus: "Usuário Testing Company",
    precisaUsuario: false,
    precisaEmpresaCadastrada: false,
    precisaDadosEmpresa: false,
  },
  {
    value: "company_user",
    labelTelaStatus: "Usuário da empresa",
    perfilEsperadoNoStatus: "Acesso vinculado à Testing Company E2E",
    precisaUsuario: false,
    precisaEmpresaCadastrada: true,
    precisaDadosEmpresa: false,
  },
  {
    value: "leader_tc",
    labelTelaStatus: "Líder TC",
    precisaUsuario: false,
    precisaEmpresaCadastrada: false,
    precisaDadosEmpresa: false,
  },
  {
    value: "technical_support",
    labelTelaStatus: "Suporte técnico",
    precisaUsuario: true,
    precisaEmpresaCadastrada: false,
    precisaDadosEmpresa: false,
  },
];

export async function prepararMocksPublicosSolicitacao(page: Page) {
  await page.route("**/api/public/clients", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "empresa-e2e-testing-company",
            name: "Testing Company E2E",
            active: true,
          },
        ],
      }),
    });
  });

  await page.route("**/api/public/company-lookup/cnpj?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        item: {
          companyName: "NEXT COMPANY TECNOLOGIA LTDA",
          fantasyName: "Next Company",
          cnpj: "19131243000197",
          cep: "01001-000",
          address: "Praça da Sé",
          number: "100",
          district: "Sé",
          city: "São Paulo",
          state: "SP",
          phone: "+55 11 4000-0000",
        },
      }),
    });
  });

  await page.route("**/api/public/company-lookup/cep?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        item: {
          cep: "01001-000",
          address: "Praça da Sé",
          district: "Sé",
          city: "São Paulo",
          state: "SP",
        },
      }),
    });
  });
}

export async function abrirFormularioSolicitacaoPorPerfil(page: Page) {
  await abrirFormularioSolicitacaoPublica(page, {
    screenshotPath: "test-results/access-request-form-nao-abriu.png",
    waitAfterLoadMs: 2000,
  });
}

export async function selecionarEmpresaCadastrada(page: Page) {
  const campoEmpresa = page.getByTestId("request-access-company-input");

  await expect(campoEmpresa).toBeVisible({ timeout: 30000 });
  await campoEmpresa.selectOption("empresa-e2e-testing-company");
}

export async function preencherDadosEmpresaPorCnpjECep(page: Page) {
  await expect(page.getByTestId("request-access-company-cnpj-input")).toBeVisible({
    timeout: 30000,
  });

  await page.getByTestId("request-access-company-cnpj-input").fill("19131243000197");
  await page.getByTestId("request-access-company-cnpj-lookup-button").click();

  await expect(page.getByTestId("request-access-company-name-input")).toHaveValue(/NEXT COMPANY/i, {
    timeout: 30000,
  });

  await page.getByTestId("request-access-company-cep-input").fill("01001000");
  await page.getByTestId("request-access-company-cep-lookup-button").click();

  await expect(page.getByTestId("request-access-company-address-input")).toHaveValue(/Praça da Sé/i, {
    timeout: 30000,
  });

  const telefoneEmpresa = page.getByTestId("request-access-company-phone-input");

  if ((await telefoneEmpresa.inputValue()).trim() === "") {
    await telefoneEmpresa.fill("+55 11 4000-0000");
  }
}

export async function preencherFormularioSolicitacaoPorPerfil(
  page: Page,
  perfil: PerfilSolicitacao,
  email: string,
) {
  await page.getByTestId("request-access-role-select").selectOption(perfil.value);

  if (perfil.precisaEmpresaCadastrada) {
    await selecionarEmpresaCadastrada(page);
  }

  if (perfil.precisaDadosEmpresa) {
    await preencherDadosEmpresaPorCnpjECep(page);
  }

  await page.getByTestId("request-access-name-input").fill(`Solicitante ${perfil.labelTelaStatus}`);
  await page.getByTestId("request-access-email-input").fill(email);
  await page.getByTestId("request-access-phone-input").fill("+55 51 99999-9999");

  const campoUsuario = page.getByTestId("request-access-user-input");

  if (await campoUsuario.isVisible().catch(() => false)) {
    await campoUsuario.fill(`usuario.${perfil.value}.validacao`);
  } else if (perfil.precisaUsuario) {
    throw new Error(`Campo usuário/login deveria aparecer para o perfil ${perfil.value}`);
  }

  await selecionarCargoAnalista(page);

  await page
    .getByTestId("request-access-title-input")
    .fill(`Solicitação de acesso - ${perfil.labelTelaStatus}`);

  await page
    .getByTestId("request-access-reason-input")
    .fill(`Validação pelo navegador para o perfil ${perfil.labelTelaStatus}.`);

  await page
    .getByTestId("request-access-password-input")
    .fill(process.env.E2E_PROFILE_PASSWORD ?? "");
}
