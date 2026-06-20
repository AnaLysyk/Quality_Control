import { expect, type Page } from "@playwright/test";

import {
  criarEmailTeste,
  limparEmailsCapturados,
  esperarEmailCapturado,
} from "../../../../api/solicitar-acesso/emails/capturar-emails";

import { capturarChaveDoEmailSolicitacao } from "../../../../api/solicitar-acesso/emails/extrair-chave-email";

import {
  abrirFormularioSolicitacaoPorPerfil,
  preencherFormularioSolicitacaoPorPerfil,
  prepararMocksPublicosSolicitacao,
  type PerfilSolicitacao,
} from "../formulario/preencher-formulario-por-perfil";

const delayMs = Number(process.env.VISUAL_STEP_DELAY_MS ?? 1800);

async function passo(nome: string, page: Page) {
  console.log(`[VISUAL][PASSO] ${nome}`);
  await page.waitForTimeout(delayMs);
}

export async function executarConsultaStatusSolicitacaoPorPerfil(page: Page, perfil: PerfilSolicitacao) {
  const email = criarEmailTeste(`visual-${perfil.value}`);

  await limparEmailsCapturados();
  await prepararMocksPublicosSolicitacao(page);

  await page.goto("/login/access-request", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await passo("Tela pública de solicitação aberta", page);

  await abrirFormularioSolicitacaoPorPerfil(page);

  await passo(`Formulário aberto para ${perfil.labelTelaStatus}`, page);

  await preencherFormularioSolicitacaoPorPerfil(page, perfil, email);

  await passo(`Formulário preenchido para ${perfil.labelTelaStatus}`, page);

  await page.screenshot({
    path: `test-results/access-requests/visual-formulario-${perfil.value}.png`,
    fullPage: true,
  });

  await expect(page.getByTestId("request-access-submit-button")).toBeEnabled({
    timeout: 30000,
  });

  const respostaSubmitPromise = page.waitForResponse(
    (response) => response.url().includes("/api/access-requests/public"),
    { timeout: 30000 },
  );

  await page.getByTestId("request-access-submit-button").click();

  const respostaSubmit = await respostaSubmitPromise;
  const corpoSubmit = await respostaSubmit.text().catch(() => "");

  console.log("[VISUAL][SOLICITAR-ACESSO]", {
    perfil: perfil.value,
    email,
    status: respostaSubmit.status(),
    body: corpoSubmit,
  });

  expect(respostaSubmit.status(), corpoSubmit).toBe(201);

  await passo(`Solicitação enviada para ${perfil.labelTelaStatus}`, page);

  await esperarEmailCapturado({
    to: email,
    subject: /Solicita.*acesso recebida|Solicitação de acesso recebida/i,
    contains: [email],
  });

  await passo(`E-mail de confirmação validado para ${perfil.labelTelaStatus}`, page);

  const chave = await capturarChaveDoEmailSolicitacao(email);

  await passo(`E-mail recebido e chave capturada para ${perfil.labelTelaStatus}`, page);

  await page.goto(`/login/access-request/status?key=${chave}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  await expect(page.getByTestId("access-request-status-result")).toBeVisible({
    timeout: 90000,
  });

  await expect(page.getByRole("heading", { name: "Acompanhamento da solicitação" })).toBeVisible();

  await expect(page.getByTestId("access-request-status-label")).toContainText(
    "Aguardando análise",
  );

  await expect(page.getByTestId("access-request-status-email")).toContainText(email);

  await expect(page.getByTestId("access-request-status-profile")).toContainText(
    perfil.perfilEsperadoNoStatus ?? perfil.labelTelaStatus,
  );

  await passo(`Status público validado para ${perfil.labelTelaStatus}`, page);

  await page.screenshot({
    path: `test-results/access-requests/visual-status-${perfil.value}.png`,
    fullPage: true,
  });
}
