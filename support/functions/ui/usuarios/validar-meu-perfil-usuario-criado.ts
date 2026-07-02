import { expect, type Page } from "@playwright/test";
import { BASE_URL } from "../../api/autenticacao/autenticar-por-cookie";

async function paginaTemCampoComValor(page: Page, valor: string) {
  return page.locator("input, textarea").evaluateAll(
    (elements, expected) =>
      elements.some((element) => {
        const field = element as HTMLInputElement | HTMLTextAreaElement;
        return field.value.trim() === expected;
      }),
    valor,
  );
}

export async function validarMeuPerfilUsuarioCriado(
  page: Page,
  dados: {
    name: string;
    email: string;
  },
) {
  await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });

  await expect(page).not.toHaveURL(/\/login/);

  const meResponse = await page.request.get(`${BASE_URL}/api/me`);
  expect(meResponse.ok()).toBeTruthy();

  const me = await meResponse.json();
  expect(me.user.email).toBe(dados.email);

  await expect
    .poll(() => paginaTemCampoComValor(page, dados.name), {
      message: `Meu Perfil deve exibir o nome ${dados.name}`,
      timeout: 30000,
    })
    .toBe(true);

  await expect
    .poll(() => paginaTemCampoComValor(page, dados.email), {
      message: `Meu Perfil deve exibir o e-mail ${dados.email}`,
      timeout: 30000,
    })
    .toBe(true);
}

