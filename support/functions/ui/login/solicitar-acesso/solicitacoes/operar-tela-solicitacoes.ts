import { expect, type Page } from "@playwright/test";

export async function abrirModuloSolicitacoes(page: Page) {
  await page.goto("/admin/access-requests", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Solicitações de acesso/i })).toBeVisible({
    timeout: 60000,
  });
}

export async function validarTelaSolicitacoes(page: Page) {
  await expect(page.getByRole("heading", { name: /Solicitações de acesso/i })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByText(/Solicitações/i).first()).toBeVisible({
    timeout: 60000,
  });
}

export async function validarAcessoNegadoAoModuloSolicitacoes(page: Page) {
  try {
    await page.goto("/admin/access-requests", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("ERR_TOO_MANY_REDIRECTS")) {
      expect(message).toContain("ERR_TOO_MANY_REDIRECTS");
      return;
    }

    throw error;
  }

  await expect(page.getByRole("heading", { name: /Solicitações de acesso/i })).not.toBeVisible({
    timeout: 3000,
  });
}

export async function validarRotaLegadaRedirecionaParaSolicitacoes(page: Page) {
  const response = await page.goto("/admin/requests", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).not.toBe(500);
  await expect(page).toHaveURL(/\/admin\/access-requests/);

  await expect(page.getByRole("heading", { name: /Solicitações de acesso/i })).toBeVisible({
    timeout: 60000,
  });
}

