import type { Page } from "@playwright/test";

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";

export const EMPRESA_E2E = {
  slug: "empresa-e2e",
  id: "cmp_e2e_client",
  name: "Empresa Cliente E2E",
};

async function esperar(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function extrairCookie(
  setCookie: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookie) return null;

  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));

  return match?.[1] ?? null;
}

export async function adicionarCookiesDeLogin(
  page: Page,
  setCookie: string | string[] | undefined,
) {
  const sessionId = extrairCookie(setCookie, "session_id");
  const authToken = extrairCookie(setCookie, "auth_token");

  if (!sessionId) return null;

  const cookies: Array<{ name: string; value: string; url: string }> = [
    { name: "session_id", value: sessionId, url: BASE_URL },
  ];

  if (authToken) {
    cookies.push({ name: "auth_token", value: authToken, url: BASE_URL });
  }

  await page.context().addCookies(cookies);

  return sessionId;
}

export async function loginDiretoComTentativas(
  page: Page,
  email: string,
  senhas: string[],
) {
  for (const password of senhas) {
    const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { user: email, password },
    });

    if (!response.ok()) continue;

    const sessionId = await adicionarCookiesDeLogin(page, response.headers()["set-cookie"]);

    if (sessionId) {
      return { ok: true, sessionId, password };
    }
  }

  return { ok: false, sessionId: null, password: null };
}

export async function autenticarAdminDeTeste(page: Page) {
  const senhaPerfil = process.env.E2E_PROFILE_PASSWORD ?? "";

  const candidatos = [
    { user: "e2e-leader-tc@testingcompany.local", password: senhaPerfil },
    { user: "e2e-suporte@testingcompany.local", password: senhaPerfil },
    { user: "admin@demo.test", password: "Demo@123" },
    { user: "admin@demo.test", password: "Griaule@123" },
  ].filter((item) => item.password);

  for (const candidato of candidatos) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
          data: {
            user: candidato.user,
            password: candidato.password,
          },
        });

        if (!response.ok()) {
          if (attempt < 3) {
            await esperar(1000 * attempt);
            continue;
          }
          break;
        }

        const sessionId = await adicionarCookiesDeLogin(page, response.headers()["set-cookie"]);

        if (sessionId) {
          return { user: candidato.user, sessionId };
        }
      } catch {
        if (attempt < 3) {
          await esperar(1000 * attempt);
          continue;
        }
      }
    }
  }

  throw new Error("Não foi possível autenticar admin de teste para o fluxo de acessos.");
}

export function montarDadosEmpresaE2E(role: string) {
  const precisaEmpresa = !["leader_tc", "technical_support"].includes(role);

  if (!precisaEmpresa) return {};

  return {
    company: EMPRESA_E2E.slug,
    company_name: EMPRESA_E2E.name,
    companySlug: EMPRESA_E2E.slug,
    clientSlug: EMPRESA_E2E.slug,
    client_id: EMPRESA_E2E.id,
    clientId: EMPRESA_E2E.id,
    companyId: EMPRESA_E2E.id,
    requestedCompanyId: EMPRESA_E2E.id,
    requestedCompanySlug: EMPRESA_E2E.slug,
  };
}
