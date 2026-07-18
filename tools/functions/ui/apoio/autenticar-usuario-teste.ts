import type { Page } from "@playwright/test";
import { simularAutenticacao } from "./simular-autenticacao";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;

const useJsonSeed = process.env.E2E_USE_JSON === "1";
const sharedPassword = process.env.E2E_PROFILE_PASSWORD || "Demo@123";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || (useJsonSeed ? "e2e-leader-tc@testingcompany.local" : "admin@demo.test");
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || sharedPassword;
const USER_EMAIL = process.env.E2E_USER_EMAIL || (useJsonSeed ? "e2e-user-tc@testingcompany.local" : "user@demo.test");
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || sharedPassword;

function montarSenhasCandidatas(primary: string) {
  return Array.from(new Set([primary, process.env.E2E_PROFILE_PASSWORD, process.env.E2E_ADMIN_PASSWORD, "Demo@123", "senha"].filter(Boolean)));
}

function montarEmailsCandidatos(primary: string, type: "admin" | "company" | "user") {
  const defaultsByType =
    type === "admin"
      ? useJsonSeed
        ? ["e2e-leader-tc@testingcompany.local", "e2e-suporte@testingcompany.local", "admin@demo.test", "admin", "ana1"]
        : ["admin@demo.test", "admin", "ana1"]
      : type === "company"
        ? ["company@demo.test", "demo"]
        : useJsonSeed
          ? ["e2e-user-tc@testingcompany.local", "e2e-company-user@empresa.local", "user@demo.test", "anapaula", "analysyk"]
          : ["user@demo.test", "anapaula", "analysyk"];
  return Array.from(new Set([primary, ...defaultsByType].filter(Boolean)));
}

type PerfilSimulado = "admin" | "client" | "user" | "technical_support" | "leader_tc";

let lastRole: PerfilSimulado | null = null;
let lastClientSlug: string | null = null;

function perfilEquivaleAdministrador(role?: string | null) {
  return role === "admin" || role === "leader_tc" || role === "technical_support";
}

function resolverCredenciais(inputEmail: string, inputPassword: string) {
  const email = inputEmail.toLowerCase();
  if (perfilEquivaleAdministrador(lastRole) || email.includes("admin")) {
    return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin" as const };
  }
  if (lastRole === "user" || email.includes("user")) {
    return { email: USER_EMAIL, password: USER_PASSWORD, role: "user" as const };
  }
  return { email: inputEmail, password: inputPassword, role: "user" as const };
}

function extrairCookie(setCookie: string | string[] | undefined, name: string): string | null {
  if (!setCookie) return null;
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function configurarUsuarioSimulado(page: Page, role: PerfilSimulado, clientSlug?: string | null) {
  lastRole = role;
  lastClientSlug = clientSlug ?? null;

  if (role === "technical_support" || role === "leader_tc") {
    await simularAutenticacao(page.context(), {
      role,
      permissionRole: role,
      companyRole: role,
      companySlug: clientSlug ?? "testing-company",
      companySlugs: [clientSlug ?? "testing-company"],
      isGlobalAdmin: role === "leader_tc",
    });
    return;
  }

  const creds = resolverCredenciais(role === "admin" ? "admin" : "user", "");
  const emailCandidates = montarEmailsCandidatos(creds.email, role === "admin" ? "admin" : "user");

  const loginUrl = new URL("/api/auth/login", baseURL).toString();
  let response: APIResponse | null = null;
  for (const emailCandidate of emailCandidates) {
    for (const passwordCandidate of montarSenhasCandidatas(creds.password)) {
      response = await page.context().request.post(loginUrl, {
        data: {
          user: emailCandidate,
          password: passwordCandidate,
          ...(lastClientSlug ? { clientSlug: lastClientSlug } : {}),
        },
      });
      if (response.ok()) break;
    }
    if (response?.ok()) break;
  }

  if (!response?.ok()) {
    const text = response ? await response.text() : "";
    throw new Error(`configurarUsuarioSimulado autenticacao falhou: ${response?.status()} ${response?.statusText()} ${text}`);
  }

  const setCookie = response.headers()["set-cookie"];
  const sessionId = extrairCookie(setCookie, "session_id");
  const authToken = extrairCookie(setCookie, "auth_token");
  const activeCompany = extrairCookie(setCookie, "active_company_slug");
  if (!sessionId) {
    throw new Error("configurarUsuarioSimulado autenticacao falhou: missing session_id cookie");
  }
  const cookies: Array<{ name: string; value: string; url: string }> = [
    { name: "session_id", value: sessionId, url: baseURL },
  ];
  if (authToken) {
    cookies.push({ name: "auth_token", value: authToken, url: baseURL });
  }
  if (activeCompany) {
    cookies.push({ name: "active_company_slug", value: activeCompany, url: baseURL });
  }
  await page.context().addCookies(cookies);
}

async function obterCookieSimulado(page: Page, cookieName: string) {
  const cookies = await page.context().cookies(baseURL);
  const match = cookies.find((cookie) => cookie.name === cookieName);
  return match?.value ?? null;
}

export async function autenticarUsuario(page: Page, email: string, password: string) {
  const sessionId = await obterCookieSimulado(page, "session_id");
  const creds = resolverCredenciais(email, password);
  if (!sessionId) {
    const loginUrl = new URL("/api/auth/login", baseURL).toString();
    const emailCandidates = montarEmailsCandidatos(creds.email, creds.role);
    let response: APIResponse | null = null;
    for (const emailCandidate of emailCandidates) {
      for (const passwordCandidate of montarSenhasCandidatas(creds.password)) {
        response = await page.context().request.post(loginUrl, {
          data: {
            user: emailCandidate,
            password: passwordCandidate,
            ...(lastClientSlug ? { clientSlug: lastClientSlug } : {}),
          },
        });
        if (response.ok()) break;
      }
      if (response?.ok()) break;
    }
    if (!response?.ok()) {
      const text = response ? await response.text() : "";
      throw new Error(`autenticacao falhou: ${response?.status()} ${response?.statusText()} ${text}`);
    }

    const setCookie = response.headers()["set-cookie"];
    const newSessionId = extrairCookie(setCookie, "session_id");
    const authToken = extrairCookie(setCookie, "auth_token");
    const activeCompany = extrairCookie(setCookie, "active_company_slug");
    if (!newSessionId) {
      throw new Error("autenticacao falhou: missing session_id cookie");
    }
    const cookies: Array<{ name: string; value: string; url: string }> = [
      { name: "session_id", value: newSessionId, url: baseURL },
    ];
    if (authToken) {
      cookies.push({ name: "auth_token", value: authToken, url: baseURL });
    }
    if (activeCompany) {
      cookies.push({ name: "active_company_slug", value: activeCompany, url: baseURL });
    }
    await page.context().addCookies(cookies);
  }

  const role = perfilEquivaleAdministrador(lastRole ?? creds.role) ? "admin" : "user";
  const companySlug = lastClientSlug || "DEMO";
  const defaultPath = role === "admin" ? "/admin/clients" : `/empresas/${companySlug}/dashboard`;

  const navigationTargets = [defaultPath, "/"];
  let lastNavigationError: unknown = null;
  for (const target of navigationTargets) {
    try {
      await page.goto(target, { timeout: 120000, waitUntil: "domcontentloaded" });
      const authLoading = page.getByText(/Validando sessao/i);
      if (await authLoading.isVisible().catch(() => false)) {
        await authLoading.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
      }
      return;
    } catch (error) {
      lastNavigationError = error;
    }
  }
  throw lastNavigationError instanceof Error
    ? lastNavigationError
    : new Error("falha ao navegar apos autenticacao");
}
