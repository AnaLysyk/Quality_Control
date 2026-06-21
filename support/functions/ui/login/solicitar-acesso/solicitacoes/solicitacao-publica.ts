import { expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type DadosSolicitacaoAcesso = {
  profile: "leader_tc" | "technical_support" | "testing_company_user" | "company_user" | "empresa";
  profileLabel: RegExp;
  requesterName: string;
  requesterEmail: string;
  requestedUser: string;
  password: string;
  phone: string;
  title: string;
  reason: string;
};

const configuredOutboxPath = process.env.EMAIL_CAPTURE_FILE || "test-results/emails/outbox.jsonl";

export const OUTBOX_PATH = path.isAbsolute(configuredOutboxPath)
  ? configuredOutboxPath
  : path.join(process.cwd(), configuredOutboxPath);

export function limparOutbox() {
  mkdirSync(path.dirname(OUTBOX_PATH), { recursive: true });
  if (existsSync(OUTBOX_PATH)) unlinkSync(OUTBOX_PATH);
}

export function lerOutbox() {
  if (!existsSync(OUTBOX_PATH)) return [];

  return readFileSync(OUTBOX_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function textoEmail(email: any) {
  return `${email.subject || ""}\n${email.to || ""}\n${email.html || ""}\n${email.text || ""}`;
}

export async function aguardarEmail(match: (email: any) => boolean, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const email = lerOutbox().reverse().find(match);
    if (email) return email;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("E-mail esperado não apareceu no outbox.");
}

export function extrairUrlConsulta(email: any) {
  const texto = textoEmail(email);
  const match = texto.match(/https?:\/\/[^"'<\s]+\/login\/access-request\/status\?key=[^"'<\s]+/i);

  if (!match) {
    throw new Error("Não encontrei a URL de consulta pública no e-mail.");
  }

  return match[0].replace(/&amp;/g, "&");
}

export function normalizarUrlParaAmbienteAtual(url: string, page: Page) {
  const atual = new URL(page.url()).origin;
  const parsed = new URL(url);
  return `${atual}${parsed.pathname}${parsed.search}`;
}

export async function criarSolicitacaoPublica(page: Page, dados: DadosSolicitacaoAcesso) {
  await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });

  const formulario = page.getByTestId("request-access-form");
  const abrir = page.getByTestId("open-request-access-form-button");

  await abrir.waitFor({ state: "visible", timeout: 20000 });
  await abrir.scrollIntoViewIfNeeded().catch(() => {});
  await abrir.click({ force: true });

  let abriu = await formulario.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);

  if (!abriu) {
    await page.getByRole("button", { name: /^Solicitar acesso$/i }).last().click({ force: true }).catch(() => {});
    abriu = await formulario.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
  }

  if (!abriu) {
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="open-request-access-form-button"]');
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });

    abriu = await formulario.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
  }

  if (!abriu) {
    console.log("[SOLICITAR ACESSO] Não abriu o formulário.");
    console.log("[SOLICITAR ACESSO] TestIds:", await page.locator("[data-testid]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-testid")).filter(Boolean)
    ));
    console.log("[SOLICITAR ACESSO] Texto:", (await page.locator("body").innerText().catch(() => "")).slice(0, 2000));
  }

  expect(abriu, "Formulário de solicitação deve abrir").toBeTruthy();

  await page.getByTestId("request-access-role-select").selectOption(dados.profile);
  await page.getByTestId("request-access-name-input").fill(dados.requesterName);
  await page.getByTestId("request-access-user-input").fill(dados.requestedUser);
  await page.getByTestId("request-access-email-input").fill(dados.requesterEmail);
  await page.getByTestId("request-access-phone-input").fill(dados.phone);
  await page.getByTestId("request-access-title-input").fill(dados.title);
  await page.getByTestId("request-access-reason-input").fill(dados.reason);
  await page.getByTestId("request-access-password-input").fill(dados.password);

  const cargo = page.getByTestId("request-access-job-title-select");

  if (await cargo.isVisible().catch(() => false)) {
    await cargo.click({ force: true });

    const analistaQa = page.getByText("Analista de QA", { exact: true }).last();
    if (await analistaQa.isVisible({ timeout: 5000 }).catch(() => false)) {
      await analistaQa.click({ force: true });
    }

    await page.getByTestId("request-access-name-input").click({ force: true }).catch(() => {});
  }

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/access-requests/public") &&
      response.request().method() === "POST",
    { timeout: 30000 },
  ).catch(() => null);

  await page.getByTestId("request-access-form").evaluate((node) => {
    const form = node as HTMLFormElement;
    form.requestSubmit();
  });

  const response = await responsePromise;

  if (!response) {
    const invalidFields = await page.getByTestId("request-access-form").evaluate((node) => {
      const form = node as HTMLFormElement;

      return Array.from(form.elements)
        .filter((element) =>
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        )
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

    console.log("[SOLICITAR ACESSO] POST não foi chamado.");
    console.log("[SOLICITAR ACESSO] Campos obrigatórios/invalidos:", invalidFields);
    console.log("[SOLICITAR ACESSO] Texto da tela:", (await page.locator("body").innerText().catch(() => "")).slice(0, 2500));

    throw new Error("A tela não chamou /api/access-requests/public ao enviar a solicitação.");
  }

  const body = await response.text();

  expect(response.ok(), `Falha ao criar solicitação pública: ${response.status()} ${body}`).toBeTruthy();

  return JSON.parse(body);
}

export async function validarEmailRecebido(email: any, dados: DadosSolicitacaoAcesso) {
  const texto = textoEmail(email);

  expect(texto).toContain(dados.requesterEmail);
  expect(texto).toContain(dados.requestedUser);
  expect(texto).toContain("Definida com segurança no formulário");
  expect(texto).toMatch(dados.profileLabel);
}

export async function validarConsultaPublicaPendente(page: Page, statusUrl: string, dados: DadosSolicitacaoAcesso) {
  await page.goto(normalizarUrlParaAmbienteAtual(statusUrl, page), { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("access-request-status-result")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("access-request-status-email")).toContainText(dados.requesterEmail);
  await expect(page.getByTestId("access-request-status-profile")).toContainText(dados.profileLabel);
  await expect(page.getByTestId("access-request-status-label")).toContainText(/pendente|análise|analise|em análise/i);
}


export async function abrirEmailParaConferencia(page: Page, email: any, nomeArquivo: string) {
  const dir = path.join(process.cwd(), "test-results", "emails", "previews");
  mkdirSync(dir, { recursive: true });

  const safeName = nomeArquivo.replace(/[^a-z0-9_.-]+/gi, "-");
  const file = path.join(dir, safeName.endsWith(".html") ? safeName : `${safeName}.html`);

  const html = String(email.html || email.text || textoEmail(email));
  writeFileSync(file, html, "utf8");

  const emailPage = await page.context().newPage();
  await emailPage.goto(pathToFileURL(file).toString(), { waitUntil: "domcontentloaded" });

  return emailPage;
}

export async function aguardarConferenciaVisual(page: Page, etapa: string) {
  if (process.env.ACCESS_REQUEST_VISUAL_REVIEW !== "true") return;

  const delay = Number(process.env.ACCESS_REQUEST_VISUAL_DELAY_MS || "8000");
  console.log(`[CONFERENCIA VISUAL] ${etapa}. Aguardando ${delay}ms...`);
  await page.waitForTimeout(delay);
}
