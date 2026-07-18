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

export type DadosSolicitacaoPreenchida = {
  email: string;
  nomeCompleto: string;
  usuario: string;
  senha: string;
  telefone: string;
  cargo: string;
  titulo: string;
  descricao: string;
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
            id: "cmp_demo",
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
  await campoEmpresa.selectOption("cmp_demo");
}

export async function preencherDadosEmpresaPorCnpjECep(page: Page, sufixo = Date.now().toString()) {
  await expect(page.getByTestId("request-access-company-cnpj-input")).toBeVisible({
    timeout: 30000,
  });

  await page.getByTestId("request-access-company-cnpj-input").fill(`19131243${sufixo.slice(-6).padStart(6, "0")}`);
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
): Promise<DadosSolicitacaoPreenchida> {
  const timestamp = Date.now();
  const sufixoUnico = `${timestamp}-${perfil.value}`;
  const nomeCompleto = `Solicitante ${perfil.labelTelaStatus} ${sufixoUnico}`;
  const usuario = `usuario.${perfil.value}.${timestamp}`;
  const senha = process.env.E2E_PROFILE_PASSWORD ?? "SenhaVisual@123";
  const telefone = `+55 51 9${timestamp.toString().slice(-8)}`;
  const cargo = "Analista de QA";
  const titulo = `Solicitação de acesso - ${perfil.labelTelaStatus} - ${sufixoUnico}`;
  const descricao = `Validação pelo navegador para o perfil ${perfil.labelTelaStatus}. Massa ${sufixoUnico}.`;

  await page.getByTestId("request-access-role-select").selectOption(perfil.value);

  if (perfil.precisaEmpresaCadastrada) {
    await selecionarEmpresaCadastrada(page);
  }

  if (perfil.precisaDadosEmpresa) {
    await preencherDadosEmpresaPorCnpjECep(page, sufixoUnico);
  }

  await page.getByTestId("request-access-name-input").fill(nomeCompleto);
  await page.getByTestId("request-access-email-input").fill(email);
  await page.getByTestId("request-access-phone-input").fill(telefone);

  const campoUsuario = page.getByTestId("request-access-user-input");

  if (await campoUsuario.isVisible().catch(() => false)) {
    await campoUsuario.fill(usuario);
  } else if (perfil.precisaUsuario) {
    throw new Error(`Campo usuário/login deveria aparecer para o perfil ${perfil.value}`);
  }

  await selecionarCargoAnalista(page);

  await page
    .getByTestId("request-access-title-input")
    .fill(titulo);

  await page
    .getByTestId("request-access-reason-input")
    .fill(descricao);

  await page
    .getByTestId("request-access-password-input")
    .fill(senha);

  return {
    email,
    nomeCompleto,
    usuario,
    senha,
    telefone,
    cargo,
    titulo,
    descricao,
  };
}



