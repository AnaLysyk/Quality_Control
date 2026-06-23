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

async function abrirFormularioConsultaPublica(page: Page) {
  const botaoAbrir = page.getByTestId("open-access-request-lookup-button");
  const formulario = page.getByTestId("access-request-lookup-form");

  await expect(botaoAbrir).toBeVisible({ timeout: 30000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  await expect
    .poll(
      () =>
        botaoAbrir.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          const props = propsKey
            ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey]
            : null;
          return typeof props?.onClick === "function";
        }),
      {
        message: "Esperando o botao de consultar solicitacao concluir a hidratacao.",
        timeout: 60000,
      },
    )
    .toBe(true);

  for (let attemptsRemaining = 6; attemptsRemaining > 0; attemptsRemaining -= 1) {
    if (await formulario.isVisible().catch(() => false)) {
      return;
    }

    await botaoAbrir.scrollIntoViewIfNeeded();
    await botaoAbrir.click();

    await expect(formulario).toBeVisible({ timeout: 3000 }).catch(() => undefined);
  }

  await page.screenshot({
    path: "test-results/access-request-lookup-form-nao-abriu.png",
    fullPage: true,
  });

  await expect(formulario).toBeVisible({ timeout: 30000 });
}

async function esperarFormularioConsultaHidratado(page: Page) {
  const formulario = page.getByTestId("access-request-lookup-form");

  await expect(formulario).toBeVisible({ timeout: 30000 });

  await expect
    .poll(
      () =>
        formulario.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          const props = propsKey
            ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey]
            : null;
          return typeof props?.onSubmit === "function";
        }),
      {
        message: "Esperando o formulário de consulta concluir a hidratação.",
        timeout: 60000,
      },
    )
    .toBe(true);
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

  const dadosPreenchidos = await preencherFormularioSolicitacaoPorPerfil(page, perfil, email);

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
  const payloadSubmit = JSON.parse(corpoSubmit) as {
    item?: {
      accessKey?: string;
      requesterName?: string;
      requesterEmail?: string;
    };
  };
  const nomeConsulta = payloadSubmit.item?.requesterName?.trim() || dadosPreenchidos.nomeCompleto;
  const emailConsulta = payloadSubmit.item?.requesterEmail?.trim().toLowerCase() || email;

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

  await page.goto("/login/access-request", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  await abrirFormularioConsultaPublica(page);

  await page.getByTestId("request-access-lookup-name-input").fill(nomeConsulta);
  await page.getByTestId("request-access-lookup-email-input").fill(emailConsulta);
  await page.getByTestId("request-access-lookup-code-input").fill(chave);

  await passo(`Consulta pública preenchida para ${perfil.labelTelaStatus}`, page);

  await esperarFormularioConsultaHidratado(page);

  const botaoConsultar = page.getByTestId("request-access-lookup-submit-button");
  await expect(botaoConsultar).toBeEnabled({ timeout: 30000 });

  const aguardarRespostaConsulta = () =>
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/access-requests/by-key/${encodeURIComponent(chave)}`),
      { timeout: 30000 },
    );

  let respostaConsulta = await Promise.all([
    aguardarRespostaConsulta().catch(() => null),
    botaoConsultar.click(),
  ]).then(([response]) => response);

  if (!respostaConsulta) {
    const formularioConsulta = page.getByTestId("access-request-lookup-form");

    respostaConsulta = await Promise.all([
      aguardarRespostaConsulta().catch(() => null),
      formularioConsulta.evaluate((form) => {
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      }),
    ]).then(([response]) => response);
  }

  expect(respostaConsulta, "A consulta pública deve chamar a API by-key").not.toBeNull();

  const corpoConsulta = await respostaConsulta!.text().catch(() => "");
  expect(respostaConsulta!.ok(), corpoConsulta).toBe(true);

  await page.waitForURL(/\/login\/access-request\/status\?key=/, {
    timeout: 90000,
    waitUntil: "domcontentloaded",
  }).catch(async (error) => {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    console.log("[VISUAL][LOOKUP][FALHA]", {
      perfil: perfil.value,
      url: page.url(),
      nomeConsulta,
      emailConsulta,
      chave,
      consultaStatus: respostaConsulta?.status(),
      consultaBody: corpoConsulta.slice(0, 2000),
      body: bodyText.slice(0, 2000),
    });
    throw error;
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
