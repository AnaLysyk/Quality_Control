import { expect, type Locator, type Page } from "@playwright/test";

import type { PerfilSolicitacao } from "../formulario/preencher-formulario-por-perfil";

type ReviewerRole = "leader_tc" | "technical_support";

export type DadosObrigatoriosAprovacao = {
  email: string;
  nomeCompleto: string;
  usuario?: string;
  senha: string;
  telefone: string;
  cargo: string;
  titulo: string;
  descricao: string;
  comentario?: string;
  reviewerRole?: ReviewerRole;
  reviewerEmail?: string;
  reviewerPassword?: string;
};

export type ResultadoAprovacaoSolicitacao = {
  requestId: string;
  username: string;
};

const reviewers: Record<ReviewerRole, { email: string; envEmail: string; envPassword: string }> = {
  leader_tc: {
    email: "e2e-leader-tc@testingcompany.local",
    envEmail: "QC_LEADER_EMAIL",
    envPassword: "QC_LEADER_PASSWORD",
  },
  technical_support: {
    email: "e2e-suporte@testingcompany.local",
    envEmail: "QC_SUPPORT_EMAIL",
    envPassword: "QC_SUPPORT_PASSWORD",
  },
};

function senhaPadraoRevisor() {
  return process.env.QC_REVIEWER_PASSWORD ?? process.env.E2E_PROFILE_PASSWORD ?? "SenhaVisual@123";
}

function emailRevisor(role: ReviewerRole, override?: string) {
  const reviewer = reviewers[role];
  return override ?? process.env[reviewer.envEmail] ?? reviewer.email;
}

function senhaRevisor(role: ReviewerRole, override?: string) {
  const reviewer = reviewers[role];
  return override ?? process.env[reviewer.envPassword] ?? senhaPadraoRevisor();
}

function extrairCookie(setCookie: string | undefined, name: string) {
  return setCookie?.match(new RegExp(`${name}=([^;]+)`))?.[1] ?? null;
}

async function sincronizarCookiesLogin(page: Page, setCookie: string | undefined) {
  const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100");
  const cookies = ["session_id", "auth_token", "access_token"]
    .map((name) => {
      const value = extrairCookie(setCookie, name);
      return value
        ? {
            name,
            value,
            domain: baseURL.hostname,
            path: "/",
            httpOnly: true,
            sameSite: "Lax" as const,
            secure: baseURL.protocol === "https:",
          }
        : null;
    })
    .filter(
      (
        cookie,
      ): cookie is {
        name: string;
        value: string;
        domain: string;
        path: string;
        httpOnly: boolean;
        sameSite: "Lax";
        secure: boolean;
      } => Boolean(cookie),
    );

  expect(cookies.some((cookie) => cookie.name === "session_id"), "Login via /api/auth/login não retornou session_id.").toBeTruthy();
  await page.context().addCookies(cookies);
}

function perfilParaLabelAdministrativo(perfil: PerfilSolicitacao) {
  const labels: Record<string, string> = {
    empresa: "Empresa",
    testing_company_user: "Usuario TC",
    company_user: "Usuario da empresa",
    leader_tc: "Lider TC",
    technical_support: "Suporte Tecnico",
  };
  return labels[perfil.value] ?? perfil.labelTelaStatus;
}

function normalizarLogin(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
}

async function selecionarPrimeiraOpcaoValida(select: Locator) {
  const value = await select.evaluate((node) => {
    const element = node as HTMLSelectElement;
    return Array.from(element.options).find((option) => option.value.trim())?.value ?? "";
  });

  expect(value, "Select obrigatório não possui opção válida.").toBeTruthy();
  await select.selectOption(value);
}

async function preencherCampoObrigatorio(locator: Locator, value: string) {
  const target = locator;
  await expect(target).toBeVisible({ timeout: 15000 });
  await target.fill(value);
}

async function selecionarPerfilSeDisponivel(page: Page, perfil: PerfilSolicitacao) {
  const select = page.getByLabel(/tipo de perfil/i).first();
  if (!(await select.isVisible().catch(() => false))) return;

  const label = perfilParaLabelAdministrativo(perfil);
  const options = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      text: (node.textContent ?? "").trim(),
    })),
  );
  const match = options.find(
    (option) =>
      option.value === label ||
      option.text === label ||
      option.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === label,
  );

  if (match?.value) {
    await select.selectOption(match.value);
  }
}

async function preencherEmpresaObrigatoriaSeExistir(page: Page) {
  const empresa = page.getByLabel(/^empresa$/i).first();
  if (!(await empresa.isVisible().catch(() => false))) return;

  const atual = await empresa.inputValue().catch(() => "");
  if (!atual.trim()) {
    await selecionarPrimeiraOpcaoValida(empresa);
  }
}

async function autenticarRevisor(page: Page, dados: DadosObrigatoriosAprovacao) {
  const role = dados.reviewerRole ?? "leader_tc";
  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.sessionStorage.removeItem("qc:auth_me:v1");
  });
  await page
    .evaluate(() => {
      window.sessionStorage.removeItem("qc:auth_me:v1");
    })
    .catch(() => {});

  const response = await page.request.post("/api/auth/login", {
    data: {
      user: emailRevisor(role, dados.reviewerEmail),
      password: senhaRevisor(role, dados.reviewerPassword),
    },
  });
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  await sincronizarCookiesLogin(page, response.headers()["set-cookie"]);
}

async function aguardarSolicitacaoNaApi(page: Page, email: string) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/admin/access-requests");
        const text = await response.text().catch(() => "");
        return response.ok() && text.toLowerCase().includes(email.toLowerCase());
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: `Aguardando solicitação ${email} aparecer na fila administrativa.`,
      },
    )
    .toBe(true);
}

export async function aprovarSolicitacaoPelaTela(
  page: Page,
  perfil: PerfilSolicitacao,
  dados: DadosObrigatoriosAprovacao,
): Promise<ResultadoAprovacaoSolicitacao> {
  await autenticarRevisor(page, dados);
  await aguardarSolicitacaoNaApi(page, dados.email);

  await page.goto("/admin/access-requests", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.getByRole("heading", { name: /solicita[cç][oõ]es de acesso/i })).toBeVisible({
    timeout: 30000,
  });

  let item = page.locator("button").filter({ hasText: dados.email }).first();
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    await page.getByPlaceholder(/buscar nome, email ou empresa/i).fill(dados.email);
    item = page.locator("button").filter({ hasText: dados.email }).first();
    try {
      await expect(item, `Solicitação criada para ${dados.email}`).toBeVisible({ timeout: 60000 });
      break;
    } catch (error) {
      if (tentativa === 2) throw error;
      await page.getByRole("button", { name: /atualizar/i }).click().catch(() => undefined);
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /solicita[cç][oõ]es de acesso/i })).toBeVisible({
        timeout: 60000,
      });
    }
  }
  await item.click();

  const username = normalizarLogin(dados.usuario || dados.email.split("@")[0] || dados.nomeCompleto);

  await selecionarPerfilSeDisponivel(page, perfil);
  await preencherCampoObrigatorio(page.getByLabel(/usu[aá]rio gerado/i).last(), username);
  await preencherCampoObrigatorio(page.getByLabel(/nome completo/i).last(), dados.nomeCompleto);
  await preencherCampoObrigatorio(page.getByLabel(/^e-?mail$/i).last(), dados.email);
  await preencherCampoObrigatorio(page.getByLabel(/^telefone$/i).last(), dados.telefone);
  await preencherEmpresaObrigatoriaSeExistir(page);
  await preencherCampoObrigatorio(page.getByLabel(/^cargo$/i).last(), dados.cargo);
  await preencherCampoObrigatorio(page.getByLabel(/t[ií]tulo da solicita/i).last(), dados.titulo);
  await preencherCampoObrigatorio(page.getByLabel(/descri[cç][aã]o final/i).last(), dados.descricao);

  const observacao = page.getByLabel(/observa[cç][aã]o interna/i).first();
  if (await observacao.isVisible().catch(() => false)) {
    await observacao.fill(dados.comentario ?? "Aprovado após validação automatizada ponta a ponta.");
  }

  const comentario = page.getByPlaceholder(/descreva o ajuste|observa[cç][aã]o interna|motivo da decis/i).first();
  if (await comentario.isVisible().catch(() => false)) {
    await comentario.fill(dados.comentario ?? "Aprovado após validação automatizada ponta a ponta.");
  }

  const approvalResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/access-requests/") &&
      response.url().includes("/accept") &&
      response.request().method() === "POST",
    { timeout: 45000 },
  );

  const approveButton = page.getByRole("button", { name: /aprovar solicita/i });
  await expect(approveButton).toBeEnabled({ timeout: 30000 });
  await approveButton.click();

  const response = await approvalResponsePromise;
  const text = await response.text().catch(() => "");
  expect(response.ok(), `Falha ao aprovar solicitação: ${response.status()} ${text}`).toBeTruthy();

  const body = JSON.parse(text) as {
    item?: {
      id?: string;
      username?: string;
    };
  };

  await expect(page.getByText(/solicita[cç][aã]o aprovada/i).first())
    .toBeVisible({ timeout: 5000 })
    .catch(() => {});

  return {
    requestId: body.item?.id ?? "",
    username: body.item?.username || username,
  };
}

