import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

import {
  perfisAutorizadosSolicitacoes,
  perfisNegadosSolicitacoes,
} from "../../../banco-de-dados/solicitar-acesso/perfis/definir-perfis-teste";

export type PerfilTesteSolicitacaoAcesso =
  | (typeof perfisAutorizadosSolicitacoes)[number]["role"]
  | (typeof perfisNegadosSolicitacoes)[number]["role"];

const profiles = [...perfisAutorizadosSolicitacoes, ...perfisNegadosSolicitacoes];

const rolesEquivalentes: Record<string, string[]> = {
  user: ["user", "testing_company_user", "company_user"],
  company: ["company", "empresa"],
};

function getProfile(role: PerfilTesteSolicitacaoAcesso) {
  const profile = profiles.find((item) => item.role === role);
  if (!profile) throw new Error(`Perfil E2E nao configurado: ${role}`);
  return profile;
}

async function esperar(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function obterSenhaTesteSolicitacaoAcesso() {
  const password = process.env.E2E_PROFILE_PASSWORD;
  if (!password) throw new Error("E2E_PROFILE_PASSWORD nao configurada.");
  return password;
}

export async function autenticarSolicitacaoAcessoViaApi(
  request: APIRequestContext,
  role: PerfilTesteSolicitacaoAcesso,
) {
  const profile = getProfile(role);
  let response: Awaited<ReturnType<APIRequestContext["post"]>> | null = null;
  let text = "";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await request.post("/api/auth/login", {
        data: {
          user: profile.email,
          password: obterSenhaTesteSolicitacaoAcesso(),
        },
      });
      text = await response.text();

      if (response.status() === 200) {
        break;
      }
    } catch (error) {
      text = error instanceof Error ? error.message : String(error);
    }

    if (attempt < 3) {
      await esperar(1000 * attempt);
    }
  }

  expect(response?.status(), text).toBe(200);

  const meResponse = await request.get("/api/me");
  const me = await meResponse.json().catch(() => null);

  expect(meResponse.status(), JSON.stringify(me)).toBe(200);
  const rolesEsperadas = rolesEquivalentes[role] ?? [role];
  expect(rolesEsperadas, JSON.stringify(me)).toContain(me?.user?.role);
  expect(me?.user?.email).toBe(profile.email);

  return profile;
}

export async function autenticarContextoSolicitacaoAcesso(
  context: BrowserContext,
  role: PerfilTesteSolicitacaoAcesso,
) {
  return autenticarSolicitacaoAcessoViaApi(context.request, role);
}

export async function autenticarSolicitacaoAcessoNaInterface(page: Page, role: PerfilTesteSolicitacaoAcesso) {
  const profile = getProfile(role);

  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const form = page.locator("form").first();
  await expect
    .poll(
      () =>
        form.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) =>
            key.startsWith("__reactProps$"),
          );
          const props = propsKey
            ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey]
            : null;
          return typeof props?.onSubmit === "function";
        }),
      {
        message: "Esperando o formulario de login concluir a hidratacao.",
        timeout: 30000,
      },
    )
    .toBe(true);

  await page.getByRole("textbox", { name: /usu[aá]rio|e-mail|email/i }).fill(profile.email);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(obterSenhaTesteSolicitacaoAcesso());

  await expect(page.getByRole("textbox", { name: /usu[aá]rio|e-mail|email/i })).toHaveValue(profile.email);
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(
    obterSenhaTesteSolicitacaoAcesso(),
  );

  return autenticarSolicitacaoAcessoViaApi(page.request, role);
}



