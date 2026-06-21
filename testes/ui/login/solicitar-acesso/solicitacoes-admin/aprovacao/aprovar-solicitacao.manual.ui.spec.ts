/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/aprovacao/aprovar-solicitacao.manual.ui.spec.ts --project=chromium
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { aprovarSolicitacaoPelaTela } from "../../../../../../support/functions/ui/login/solicitar-acesso/aprovacao/aprovar-solicitacao";
import type { PerfilSolicitacao } from "../../../../../../support/functions/ui/login/solicitar-acesso/formulario/preencher-formulario-por-perfil";

const OUTBOX_PATH = path.join(process.cwd(), "test-results", "emails", "outbox.jsonl");
const EMAIL_PREVIEW_DIR = path.join(process.cwd(), "test-results", "emails", "visual-access-approval");
const STEP_DELAY_MS = Number(process.env.ACCESS_APPROVAL_VISUAL_DELAY_MS || "1400");

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100" });

type Reviewer = {
  name: string;
  email: string;
  password: string;
};

type RequestData = {
  profile: "leader_tc" | "technical_support";
  profileLabel: string;
  requesterName: string;
  requesterEmail: string;
  requestedUser: string;
  password: string;
  phone: string;
  title: string;
  description: string;
};

const reviewers: Reviewer[] = [
  {
    name: "Líder TC",
    email: process.env.QC_LEADER_EMAIL || "",
    password: process.env.QC_LEADER_PASSWORD || "",
  },
  {
    name: "Suporte Técnico",
    email: process.env.QC_SUPPORT_EMAIL || "",
    password: process.env.QC_SUPPORT_PASSWORD || "",
  },
];

async function delay(ms = STEP_DELAY_MS) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

function clearOutbox() {
  mkdirSync(path.dirname(OUTBOX_PATH), { recursive: true });
  if (existsSync(OUTBOX_PATH)) unlinkSync(OUTBOX_PATH);
}

function parseOutbox() {
  if (!existsSync(OUTBOX_PATH)) return [];

  return readFileSync(OUTBOX_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function emailText(item: any) {
  return `${item.subject || ""}\n${item.to || ""}\n${item.html || ""}\n${item.text || ""}`;
}

async function waitForEmail(match: (item: any) => boolean, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const found = parseOutbox().reverse().find(match);
    if (found) return found;
    await delay(700);
  }

  const emails = parseOutbox();
  console.log("[VISUAL ACCESS] Outbox encontrado:", emails.length);
  console.log("[VISUAL ACCESS] Assuntos:", emails.map((item) => item.subject || "(sem assunto)"));
  console.log("[VISUAL ACCESS] Último e-mail:", emails.at(-1));
  throw new Error("E-mail esperado não apareceu no outbox.");
}

function extractStatusUrl(item: any) {
  const all = emailText(item);
  const match = all.match(/https?:\/\/[^"'<\s]+\/login\/access-request\/status\?key=[^"'<\s]+/i);
  if (!match) throw new Error("Não encontrei link de consulta pública no e-mail.");
  return match[0].replace(/&amp;/g, "&");
}

function normalizeToCurrentOrigin(url: string, page: Page) {
  const currentOrigin = new URL(page.url()).origin;
  const parsed = new URL(url);
  return `${currentOrigin}${parsed.pathname}${parsed.search}`;
}

async function firstVisible(locators: Locator[], label: string) {
  for (const locator of locators) {
    const first = locator.first();

    try {
      await first.waitFor({ state: "visible", timeout: 4000 });
      return first;
    } catch {
      // tenta o próximo
    }
  }

  throw new Error(`Não encontrei: ${label}`);
}

async function fillIfVisible(locator: Locator, value: string) {
  if (await locator.first().isVisible().catch(() => false)) {
    await locator.first().fill(value);
    await delay();
  }
}

async function clickByText(page: Page, names: RegExp[], label: string) {
  const target = await firstVisible(
    [
      ...names.map((name) => page.getByRole("button", { name })),
      ...names.map((name) => page.getByRole("link", { name })),
      ...names.map((name) => page.locator("button,a").filter({ hasText: name })),
    ],
    label,
  );

  await target.click();
  await delay();
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await delay();

  const emailInput = await firstVisible(
    [
      page.getByTestId("login-email-input"),
      page.getByPlaceholder(/e-?mail|usuário|usuario/i),
      page.getByLabel(/e-?mail|usuário|usuario/i),
      page.locator('input[type="email"]'),
      page.locator("input").first(),
    ],
    "campo de login",
  );

  await emailInput.fill(email);
  await delay();

  const passwordInput = await firstVisible(
    [
      page.getByTestId("login-password-input"),
      page.getByPlaceholder(/senha/i),
      page.getByLabel(/senha/i),
      page.locator('input[type="password"]'),
    ],
    "campo de senha",
  );

  await passwordInput.fill(password);
  await delay();

  await clickByText(page, [/entrar/i, /acessar/i, /login/i], "botão entrar");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 25000 });
  await delay(2000);
}

async function logout(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await delay();
}

async function criarSolicitacaoPublica(page: Page, data: RequestData) {
  await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });
  await delay();

  const openButton = page.getByTestId("open-request-access-form-button");
  await openButton.waitFor({ state: "visible", timeout: 20000 });

  await openButton.scrollIntoViewIfNeeded().catch(() => {});
  await delay(300);
  await openButton.click({ force: true });
  await delay(1000);

  let formOpened = await page.getByTestId("request-access-form").isVisible().catch(() => false);

  if (!formOpened) {
    console.log("[VISUAL ACCESS] Clique normal não abriu o formulário. Tentando click por texto.");
    await page.getByRole("button", { name: /^Solicitar acesso$/i }).last().click({ force: true }).catch(() => {});
    await delay(1000);
    formOpened = await page.getByTestId("request-access-form").isVisible().catch(() => false);
  }

  if (!formOpened) {
    console.log("[VISUAL ACCESS] Click por texto não abriu. Tentando dispatchEvent no botão.");
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="open-request-access-form-button"]');
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
    await delay(1000);
    formOpened = await page.getByTestId("request-access-form").isVisible().catch(() => false);
  }

  if (!formOpened) {
    console.log("[VISUAL ACCESS] Não abriu o formulário.");
    console.log("[VISUAL ACCESS] TestIds na tela:", await page.locator("[data-testid]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-testid")).filter(Boolean)
    ));
    console.log("[VISUAL ACCESS] Texto da tela:", (await page.locator("body").innerText().catch(() => "")).slice(0, 3000));
    throw new Error("Não conseguiu abrir o formulário de Solicitar acesso.");
  }

  const accessRequestForm = page.getByTestId("request-access-form");
  await accessRequestForm.waitFor({ state: "visible", timeout: 20000 });

  const roleSelect = page.getByTestId("request-access-role-select");
  await roleSelect.waitFor({ state: "visible", timeout: 20000 });
  await roleSelect.selectOption(data.profile);
  await delay();

  await page.getByTestId("request-access-name-input").fill(data.requesterName);
  await delay();

  await page.getByTestId("request-access-user-input").fill(data.requestedUser);
  await delay();

  await page.getByTestId("request-access-email-input").fill(data.requesterEmail);
  await delay();

  await fillIfVisible(page.getByTestId("request-access-phone-input"), data.phone);
  await fillIfVisible(page.getByTestId("request-access-title-input"), data.title);
  await fillIfVisible(page.getByTestId("request-access-reason-input"), data.description);

  const jobTrigger = page.getByTestId("request-access-job-title-select");
  if (await jobTrigger.first().isVisible().catch(() => false)) {
    await jobTrigger.first().click();
    await delay();

    const qaOptionByText = page.getByText("Analista de QA", { exact: true }).last();

    if (await qaOptionByText.isVisible({ timeout: 10000 }).catch(() => false)) {
      await qaOptionByText.click({ force: true });
      await delay(800);
    } else {
      console.log("[VISUAL ACCESS] Não encontrei Analista de QA como texto visível.");
      console.log("[VISUAL ACCESS] Texto da tela:", (await page.locator("body").innerText().catch(() => "")).slice(0, 3000));
    }

    await expect(page.getByTestId("request-access-form")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("request-access-name-input").click({ force: true }).catch(() => {});
    await delay(500);
  }

  const passwordInput = page.getByTestId("request-access-password-input");
  if (await passwordInput.first().isVisible().catch(() => false)) {
    await passwordInput.first().fill(data.password);
    await delay();
  } else {
    const passwordInputs = page.locator('input[type="password"]');
    const count = await passwordInputs.count();

    if (count >= 1) {
      await passwordInputs.nth(0).fill(data.password);
      await delay();
    }

    if (count >= 2) {
      await passwordInputs.nth(1).fill(data.password);
      await delay();
    }
  }

  const responsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/api/access-requests/public") &&
        response.request().method() === "POST",
      { timeout: 25000 },
    )
    .catch(() => null);

  const submitForm = page.getByTestId("request-access-form");
  await submitForm.waitFor({ state: "visible", timeout: 15000 });

  console.log("[VISUAL ACCESS] Enviando solicitação pelo form.requestSubmit().");

  await submitForm.evaluate((node) => {
    const formElement = node as HTMLFormElement;
    formElement.requestSubmit();
  });

  const response = await responsePromise;

  if (!response) {
    console.log("[VISUAL ACCESS] Nenhum POST /api/access-requests/public foi capturado.");
    console.log("[VISUAL ACCESS] URL atual:", page.url());
    console.log("[VISUAL ACCESS] Texto da tela:", (await page.locator("body").innerText().catch(() => "")).slice(0, 3000));
    const invalidFields = await page.getByTestId("request-access-form").evaluate((node) => {
      const form = node as HTMLFormElement;
      return Array.from(form.elements)
        .filter((element) => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)
        .map((element: any) => ({
          name: element.name,
          testId: element.getAttribute("data-testid"),
          value: element.value,
          required: element.required,
          valid: element.validity?.valid,
          message: element.validationMessage,
        }))
        .filter((item) => item.required || item.valid === false);
    }).catch(() => []);

    console.log("[VISUAL ACCESS] Campos obrigatórios/invalidos:", invalidFields);
    throw new Error("A tela não chamou /api/access-requests/public ao enviar a solicitação.");
  }

  const body = await response.text().catch(() => "");
  console.log("[VISUAL ACCESS] POST /api/access-requests/public:", response.status(), body.slice(0, 2000));

  expect(response.ok(), `Falha ao criar solicitação pública: ${response.status()} ${body}`).toBeTruthy();

  await expect(page.getByText(/recebida|enviada|sucesso|acompanhar|consulta/i).first()).toBeVisible({ timeout: 20000 });
  await delay(2500);
}



async function abrirEmail(page: Page, item: any, filename: string) {
  mkdirSync(EMAIL_PREVIEW_DIR, { recursive: true });

  const html = String(item.html || "");
  const file = path.join(EMAIL_PREVIEW_DIR, filename);
  writeFileSync(file, html, "utf8");

  const emailPage = await page.context().newPage();
  await emailPage.goto(pathToFileURL(file).toString(), { waitUntil: "domcontentloaded" });
  await delay(2500);

  return emailPage;
}

async function validarConsultaPublica(page: Page, statusUrl: string, data: RequestData, expectedStatus: RegExp) {
  await page.goto(normalizeToCurrentOrigin(statusUrl, page), { waitUntil: "domcontentloaded" });
  await delay(2500);

  await expect(page.getByTestId("access-request-status-result")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("access-request-status-label")).toContainText(expectedStatus);
  await expect(page.getByTestId("access-request-status-profile")).toContainText(data.profileLabel);
  await expect(page.getByTestId("access-request-status-email")).toContainText(data.requesterEmail);
  await delay(2500);
}

async function aprovarSolicitacaoComoRevisor(page: Page, reviewer: Reviewer, data: RequestData) {
  const perfil: PerfilSolicitacao = {
    value: data.profile,
    labelTelaStatus: data.profileLabel,
    precisaUsuario: data.profile === "technical_support",
    precisaEmpresaCadastrada: false,
    precisaDadosEmpresa: false,
  };

  await aprovarSolicitacaoPelaTela(page, perfil, {
    email: data.requesterEmail,
    nomeCompleto: data.requesterName,
    usuario: data.requestedUser,
    senha: data.password,
    telefone: data.phone,
    cargo: "Analista de QA",
    titulo: data.title,
    descricao: data.description,
    comentario: `Fluxo visual completo aprovado por ${reviewer.name}.`,
    reviewerRole: data.profile === "technical_support" ? "leader_tc" : "leader_tc",
    reviewerEmail: reviewer.email || undefined,
    reviewerPassword: reviewer.password || undefined,
  });

  await delay(3000);
}

async function validarLoginUsuarioCriado(page: Page, data: RequestData) {
  await logout(page);

  await login(page, data.requestedUser, data.password);

  await page.goto("/settings/profile", { waitUntil: "domcontentloaded" }).catch(async () => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
  });

  await delay(2500);

  await expect(page.getByText(data.requesterName).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(data.requesterEmail).first()).toBeVisible({ timeout: 20000 });
  await delay(2500);
}

test.describe("VISUAL - Solicitação de acesso com aprovação", () => {
  test.describe.configure({ timeout: 600000 });
  test.beforeEach(() => {
    clearOutbox();
  });

  for (const reviewer of reviewers) {
    test(`solicitação pública aprovada por ${reviewer.name}`, async ({ page }) => {
      test.setTimeout(600000);

      const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
      const reviewerSlug = reviewer.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const data: RequestData = {
        profile: reviewer.name.includes("Suporte") ? "technical_support" : "leader_tc",
        profileLabel: reviewer.name.includes("Suporte") ? "Suporte técnico" : "Líder TC",
        requesterName: `Visual Aprovação ${reviewer.name} ${suffix}`,
        requesterEmail: `visual-aprovacao-${reviewerSlug}-${suffix}@demo.test`,
        requestedUser: `visual-${reviewerSlug}-${suffix}`,
        password: "SenhaVisual@123",
        phone: "+55 11 4000-0000",
        title: `Solicitação visual ${reviewer.name}`,
        description: `Fluxo visual completo de solicitação aprovada por ${reviewer.name}.`,
      };

      await criarSolicitacaoPublica(page, data);

      const receivedEmail = await waitForEmail((item) => {
        const all = emailText(item);
        return (
          all.includes(data.requesterEmail) &&
          all.includes(data.requestedUser) &&
          /senha cadastrada|definida com segurança/i.test(all)
        );
      });

      const receivedEmailPage = await abrirEmail(page, receivedEmail, `recebida-${reviewer.name}.html`);

      await expect(receivedEmailPage.getByText(/Quality Control/i).first()).toBeVisible();
      await expect(receivedEmailPage.getByText(data.profile === "technical_support" ? /Suporte técnico/i : /Líder TC/i).first()).toBeVisible();
      await expect(receivedEmailPage.getByText(data.requesterEmail).first()).toBeVisible();
      await expect(receivedEmailPage.getByText(/Definida com segurança/i).first()).toBeVisible();

      const statusUrl = extractStatusUrl(receivedEmail);

      await validarConsultaPublica(page, statusUrl, data, /aguardando análise|em análise|análise|pendente/i);

      await aprovarSolicitacaoComoRevisor(page, reviewer, data);

      const approvedEmail = await waitForEmail((item) => {
        const all = emailText(item);
        return (
          all.includes(data.requesterEmail) &&
          all.includes(data.requestedUser) &&
          /aprovad|bem-vindo|acesso/i.test(all)
        );
      }, 45000);

      const approvedEmailPage = await abrirEmail(page, approvedEmail, `aprovada-${reviewer.name}.html`);

      await expect(approvedEmailPage.getByText(/Quality Control/i).first()).toBeVisible();
      await expect(approvedEmailPage.getByText(data.profile === "technical_support" ? /Suporte técnico/i : /Líder TC/i).first()).toBeVisible();
      await expect(approvedEmailPage.getByText(data.requestedUser).first()).toBeVisible();

      await validarLoginUsuarioCriado(page, data);

      await logout(page);

      await validarConsultaPublica(page, statusUrl, data, /aprovad/i);
    });
  }
});

