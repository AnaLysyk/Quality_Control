import { expect, type Page } from "@playwright/test";
import type { DadosSolicitacaoAcessoPublica } from "../../api/solicitar-acesso/criar-solicitacao-publica";

export async function abrirFormularioPublicoSolicitarAcesso(page: Page) {
  await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });

  const botaoCriar = page.getByText(/Criar solicitação|Solicitar acesso|Nova solicitação/i).last();
  await expect(botaoCriar).toBeVisible();
  await botaoCriar.click();

  await expect(
    page.getByTestId("request-access-form").or(page.getByRole("dialog")),
  ).toBeVisible();
}

export async function selecionarPrimeiraProfissao(page: Page) {
  await page.getByText("Selecione uma profissão").first().click();

  const options = page.locator('[role="option"]');
  const count = await options.count();

  if (count > 1) {
    await options.nth(1).click();
    return;
  }

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

export async function preencherSolicitacaoPublicaAcesso(
  page: Page,
  payload: DadosSolicitacaoAcessoPublica,
) {
  await page.getByTestId("request-access-role-select").selectOption(payload.profile_type);

  await page.getByTestId("request-access-name-input").fill(payload.full_name);
  await page.getByTestId("request-access-user-input").fill(payload.user);
  await page.getByTestId("request-access-email-input").fill(payload.email);
  await page.getByTestId("request-access-phone-input").fill(payload.phone);

  await selecionarPrimeiraProfissao(page);

  await page.getByTestId("request-access-title-input").fill(payload.title);
  await page.getByTestId("request-access-reason-input").fill(payload.description);
  await page.getByTestId("request-access-password-input").fill(payload.password);
}

export async function enviarSolicitacaoPublicaAcesso(page: Page) {
  await page.getByTestId("request-access-submit-button").click();
}

export async function validarSucessoSolicitacaoPublica(page: Page) {
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/solicita/i);
}

export async function validarErroDuplicidadeSolicitacaoPublica(page: Page) {
  await expect(
    page.getByText(/Já existe uma solicitação de acesso aberta ou em análise/i),
  ).toBeVisible();
}
