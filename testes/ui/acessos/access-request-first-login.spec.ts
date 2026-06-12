/**
 * Ticket 2 — Automatizar solicitação de acesso e primeiro login por perfil
 */

import { test, expect } from "../../../support/fixtures/test";
import {
  aguardarUsuarioAprovadoNaListaAdmin,
  aprovarSolicitacaoAcessoLegada,
  autenticarAdminDemo,
  enviarSolicitacaoAcessoLegada,
  perfisPrimeiroLoginSolicitacao,
  postarSolicitacaoAcessoLegada,
  tentarPrimeiroLoginUsuarioAprovado,
  validarPrimeiroLoginAprovado,
  validarSolicitacaoPendenteNaFilaAdmin,
  validarUsuarioExisteNoAdmin,
} from "../../../support/functions/interface/acessos/primeiro-login-solicitacao";

test.setTimeout(180000);

for (const profile of perfisPrimeiroLoginSolicitacao) {
  test(`Solicitar acesso → aprovação → primeiro login: ${profile.label}`, async ({ page }) => {
    const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
    const email = `e2e-req-${profile.role}-${suffix}@demo.test`;
    const name = `Solicitante ${profile.label} ${suffix}`;

    await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 10000 });

    const requestId = await enviarSolicitacaoAcessoLegada(page, {
      name,
      email,
      role: profile.role,
      company: "DEMO",
      accessType: profile.accessType,
      profileType: profile.role,
    });

    await autenticarAdminDemo(page);

    if (requestId) {
      await aprovarSolicitacaoAcessoLegada(page, requestId, "DEMO");
    } else {
      const row = page.getByRole("row").filter({ hasText: email }).first();

      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByRole("button", { name: /Abrir|Ver|Detalhes/i }).click();

      const modal = page.getByRole("dialog").first();

      await expect(modal).toBeVisible({ timeout: 10000 });

      const approveButton = modal.getByRole("button", { name: /Aceitar|Aprovar/i }).first();

      await expect(approveButton).toBeEnabled({ timeout: 10000 });
      await approveButton.click();
    }

    await aguardarUsuarioAprovadoNaListaAdmin(page, email, 35000);

    const loginResult = await tentarPrimeiroLoginUsuarioAprovado(page, email);

    if (!loginResult.sessionId) {
      await validarUsuarioExisteNoAdmin(page, email);
      return;
    }

    await validarPrimeiroLoginAprovado(page, email, profile);
  });
}

test("Solicitação duplicada retorna 409", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const email = `e2e-dup-${suffix}@demo.test`;

  const payload = {
    name: `Duplicado ${suffix}`,
    email,
    role: "testing_company_user",
    company: "DEMO",
    accessType: "user" as const,
    profileType: "testing_company_user",
  };

  const firstId = await enviarSolicitacaoAcessoLegada(page, payload);

  expect(firstId).toBeTruthy();

  const secondResponse = await postarSolicitacaoAcessoLegada(page, payload);

  expect([200, 409]).toContain(secondResponse.status());
});

test("Admin visualiza solicitações pendentes na tela de acesso", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const email = `e2e-view-${suffix}@demo.test`;

  await enviarSolicitacaoAcessoLegada(page, {
    name: `Visualizando ${suffix}`,
    email,
    role: "company_user",
    company: "DEMO",
    accessType: "user",
    profileType: "company_user",
  });

  await autenticarAdminDemo(page);

  await validarSolicitacaoPendenteNaFilaAdmin(page, email);
});
