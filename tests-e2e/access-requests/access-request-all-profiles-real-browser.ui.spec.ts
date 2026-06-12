import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import {
  criarEmailTeste,
  limparEmailsCapturados,
} from "../../support/functions/access-requests/access-requests.email";

type PerfilSolicitacao = {
  value: string;
  labelTelaStatus: string;
  precisaUsuario: boolean;
  precisaEmpresaCadastrada: boolean;
  precisaDadosEmpresa: boolean;
};

const perfis: PerfilSolicitacao[] = [
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

async function prepararMocksPublicos(page: Page) {
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

function listarEmailsCapturados() {
  const file = process.env.EMAIL_CAPTURE_FILE ?? "test-results/emails/access-request-outbox.jsonl";

  if (!fs.existsSync(file)) {
    return [];
  }

  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as {
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
    });
}

async function capturarChaveDoEmail(email: string) {
  let emailRecebido:
    | {
        to?: string;
        subject?: string;
        text?: string;
        html?: string;
      }
    | null = null;

  const startedAt = Date.now();
  const timeoutMs = 90000;

  while (Date.now() - startedAt < timeoutMs) {
    const emails = listarEmailsCapturados();

    emailRecebido =
      emails.find((item) => {
        const to = String(item.to ?? "").toLowerCase();
        const subject = String(item.subject ?? "");
        const body = `${item.text ?? ""}\n${item.html ?? ""}`;

        return (
          to.includes(email.toLowerCase()) &&
          subject.includes("Solicitação de acesso recebida") &&
          (body.includes("Código de consulta") || body.includes("status?key="))
        );
      }) ?? null;

    if (emailRecebido) break;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  expect(emailRecebido, `Esperando e-mail capturado para ${email}`).not.toBeNull();

  const corpo = `${emailRecebido?.text ?? ""}\n${emailRecebido?.html ?? ""}`;

  const chave =
    corpo.match(/(?:Chave de acesso|Código de consulta):?\s*([A-Za-z0-9_-]{8,})/i)?.[1] ??
    corpo.match(/status\?key=([A-Za-z0-9_-]+)/i)?.[1] ??
    corpo.match(/key=([A-Za-z0-9_-]+)/i)?.[1];

  expect(chave, "Chave/accessKey deve existir no e-mail capturado").toBeTruthy();

  return chave!;
}

async function abrirFormularioSolicitacao(page: Page) {
  const botaoAbrir = page.getByTestId("open-request-access-form-button");
  const formulario = page.getByTestId("request-access-form");

  await expect(botaoAbrir).toBeVisible({ timeout: 30000 });

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  for (let attemptsRemaining = 6; attemptsRemaining > 0; attemptsRemaining -= 1) {
    if (await formulario.isVisible().catch(() => false)) return;

    await botaoAbrir.scrollIntoViewIfNeeded();
    await botaoAbrir.click({ force: true });

    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: "test-results/access-request-form-nao-abriu.png",
    fullPage: true,
  });

  await expect(formulario).toBeVisible({ timeout: 30000 });
}

async function selecionarCargo(page: Page) {
  await page.getByRole("combobox").filter({ hasText: /selecione uma profissão/i }).click();
  await page.getByRole("option", { name: /analista/i }).first().click();
}

async function selecionarEmpresaCadastrada(page: Page) {
  const campoEmpresa = page.getByTestId("request-access-company-input");

  await expect(campoEmpresa).toBeVisible({ timeout: 30000 });
  await campoEmpresa.selectOption("empresa-e2e-testing-company");
}

async function preencherDadosEmpresaPorCnpjECep(page: Page) {
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

async function preencherFormulario(page: Page, perfil: PerfilSolicitacao, email: string) {
  await page.getByTestId("request-access-role-select").selectOption(perfil.value);

  if (perfil.precisaEmpresaCadastrada) {
    await selecionarEmpresaCadastrada(page);
  }

  if (perfil.precisaDadosEmpresa) {
    await preencherDadosEmpresaPorCnpjECep(page);
  }

  await page.getByTestId("request-access-name-input").fill(`Ana Teste ${perfil.labelTelaStatus}`);
  await page.getByTestId("request-access-email-input").fill(email);
  await page.getByTestId("request-access-phone-input").fill("+55 51 99999-9999");

  const campoUsuario = page.getByTestId("request-access-user-input");

  if (await campoUsuario.isVisible().catch(() => false)) {
    await campoUsuario.fill(`usuario.${perfil.value}.teste`);
  } else if (perfil.precisaUsuario) {
    throw new Error(`Campo usuário/login deveria aparecer para o perfil ${perfil.value}`);
  }

  await selecionarCargo(page);

  await page
    .getByTestId("request-access-title-input")
    .fill(`Solicitação de acesso - ${perfil.labelTelaStatus}`);

  await page
    .getByTestId("request-access-reason-input")
    .fill(`Teste real pelo navegador para validar criação de solicitação do perfil ${perfil.labelTelaStatus}.`);

  await page.getByTestId("request-access-password-input").fill("SenhaTeste123!");
}

test.describe("Solicitação de acesso - todos os perfis", () => {
  test.setTimeout(120000);

  for (const perfil of perfis) {
    test(`deve solicitar acesso para o perfil ${perfil.labelTelaStatus}`, async ({ page }) => {
      const email = criarEmailTeste(`perfil-${perfil.value}`);

      await limparEmailsCapturados();
      await prepararMocksPublicos(page);

      await page.goto("/login/access-request", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await abrirFormularioSolicitacao(page);

      await preencherFormulario(page, perfil, email);

      await expect(page.getByTestId("request-access-submit-button")).toBeEnabled({
        timeout: 30000,
      });
      await page.screenshot({
        path: `test-results/access-requests/form-${perfil.value}.png`,
        fullPage: true,
      });

      await page.getByTestId("request-access-submit-button").click();

      const chave = await capturarChaveDoEmail(email);

      await page.goto(`/login/access-request/status?key=${chave}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });

      await expect(page.getByTestId("access-request-status-result")).toBeVisible({
        timeout: 90000,
      });

      await expect(page.getByRole("heading", { name: "Acompanhamento da solicitação" })).toBeVisible();
      await expect(page.getByTestId("access-request-status-label")).toContainText("Aguardando análise");
      await expect(page.getByText("Sua solicitação foi recebida")).toBeVisible();
      await expect(page.getByText("Dados da solicitação")).toBeVisible();
      await expect(page.getByText(`Ana Teste ${perfil.labelTelaStatus}`)).toBeVisible();
      await expect(page.getByTestId("access-request-status-email")).toContainText(email);
      await expect(page.getByTestId("access-request-status-profile")).toContainText(
        perfil.labelTelaStatus,
      );

      await expect(page.getByText("medium")).toHaveCount(0);
      await page.screenshot({
        path: `test-results/access-requests/status-${perfil.value}.png`,
        fullPage: true,
      });
    });
  }
});
