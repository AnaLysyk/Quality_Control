
// Imports apenas de tipos e helpers puros
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { fetchBackend } from "@/lib/backendProxy";


const MOCK_PASSWORD = "senha";
const MOCK_EMAILS = new Set(["admin@example.com", "user@example.com"]);


function sanitizeEnvValue(value: string | undefined) {
  if (!value) return "";
  let raw = value.trim();
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}


// Helpers para obter env/config em runtime
function getEnvConfig() {
  // Importações runtime
  const { ALLOW_SUPABASE_MOCK_IN_PROD, IS_PROD, SUPABASE_MOCK, SUPABASE_MOCK_RAW } = require("@/lib/supabaseMock");
  const { isSupabaseDisabled } = require("@/lib/envFlags");
  const SUPABASE_URL = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const SUPABASE_ANON_KEY = sanitizeEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );
  const SUPABASE_AVAILABLE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && !isSupabaseDisabled();
  const AUTH_COOKIE_NAME = (process.env.AUTH_COOKIE_NAME ?? "auth_token").trim() || "auth_token";
  const IS_TEST = process.env.NODE_ENV === "test";
  return {
    ALLOW_SUPABASE_MOCK_IN_PROD,
    IS_PROD,
    SUPABASE_MOCK,
    SUPABASE_MOCK_RAW,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_AVAILABLE,
    AUTH_COOKIE_NAME,
    IS_TEST,
  };
}

function isPrismaConfigError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("PRISMA_NOT_CONFIGURED");
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function getErrorName(err: unknown): string {
  const name = (err as { name?: unknown } | null)?.name;
  return typeof name === "string" ? name : "";
}

function getErrorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
}

function isPrismaSchemaError(err: unknown): boolean {
  const code = getErrorCode(err);
  if (code === "P2021" || code === "P2022") return true;
  const message = getErrorMessage(err).toLowerCase();
  return message.includes("does not exist") || message.includes("no such table");
}

function isPrismaConnectionError(err: unknown): boolean {
  const code = getErrorCode(err);
  if (code.startsWith("P100")) return true;
  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("connection refused") ||
    message.includes("connection") && message.includes("timeout")
  );
}

function isPrismaRuntimeError(err: unknown): boolean {
  const name = getErrorName(err).toLowerCase();
  if (name.includes("prisma")) return true;
  const code = getErrorCode(err);
  return code.startsWith("P");
}

function isPrismaDbError(err: unknown): boolean {
  return isPrismaRuntimeError(err) || isPrismaSchemaError(err) || isPrismaConnectionError(err);
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}


function setAuthCookies(res: NextResponse, token: string, maxAgeSeconds: number, AUTH_COOKIE_NAME: string) {
  const names = new Set<string>([AUTH_COOKIE_NAME, "sb-access-token", "access_token"]);
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
  for (const name of names) {
    res.cookies.set(name, token, options);
  }
}

// Validacao real no banco

async function validateUser(
  email: string,
  password: string,
  cookieHeader: string | null = null,
  useMock: boolean,
) {
  if (useMock) {
    const normalizedEmail = (email ?? "").trim().toLowerCase();
    if (!normalizedEmail || !MOCK_EMAILS.has(normalizedEmail)) {
      return null;
    }
    if (password !== MOCK_PASSWORD) {
      return null;
    }
    const mockRole = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const mockSlug = (readCookieValue(cookieHeader, "mock_client_slug") ?? "griaule").trim();
    const companySlug = mockSlug || "griaule";
    const role = mockRole === "admin" ? "admin" : mockRole === "company" ? "company" : "user";
    return {
      userId: `${role}-mock-${companySlug}`,
      email: normalizedEmail,
      name: role === "admin" ? "Mock Admin" : "Mock User",
      companyId: `mock-company-${companySlug}`,
      companySlug,
      role,
    };
  }
  // Importa prisma só aqui
  const { prisma } = require("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userCompanies: {
        include: {
          company: true,
        },
      },
    },
  });
  if (!user || !user.active) {
    return null;
  }
  const hashedInput = hashPasswordSha256(password);
  if (hashedInput !== user.password_hash) {
    return null;
  }
  // Assumir primeira empresa como ativa (pode ser melhorado depois)
  const activeCompany = user.userCompanies[0];
  if (!activeCompany) {
    return null;
  }
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: activeCompany.company.id,
    companySlug: activeCompany.company.slug,
    role: activeCompany.role,
  };
}


export async function POST(req: Request) {
  // Importa runtime tudo que depende de ambiente/config
  const { getRedis } = require("@/lib/redis");
  const { isPrismaConfigured } = require("@/lib/prisma");
  const { createClient } = require("@supabase/supabase-js");
  const {
    ALLOW_SUPABASE_MOCK_IN_PROD,
    IS_PROD,
    SUPABASE_MOCK,
    SUPABASE_MOCK_RAW,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_AVAILABLE,
    AUTH_COOKIE_NAME,
    IS_TEST,
  } = getEnvConfig();

  if (SUPABASE_MOCK_RAW && IS_PROD && !ALLOW_SUPABASE_MOCK_IN_PROD) {
    console.warn("/api/auth/login: SUPABASE_MOCK ignored in production/Vercel");
  }

  const body = await req.json().catch(() => null);
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatorios" }, { status: 400 });
  }

  if (!IS_TEST && !SUPABASE_MOCK && !SUPABASE_MOCK_RAW) {
    const loginValue = (body?.login ?? body?.email ?? body?.user ?? email) as string;
    const backendRes = await fetchBackend(req, "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: loginValue, password }),
    });

    if (backendRes) {
      const payload = (await backendRes.json().catch(() => null)) as Record<string, unknown> | null;
      if (!backendRes.ok) {
        const message =
          (payload && typeof payload.error === "string" ? payload.error : null) ||
          (payload && typeof (payload as any)?.message === "string" ? (payload as any).message : null) ||
          "Erro ao autenticar";
        return NextResponse.json({ error: message }, { status: backendRes.status });
      }

      const res = NextResponse.json({ ok: true });
      const setCookie = backendRes.headers.get("set-cookie");
      if (setCookie) res.headers.set("set-cookie", setCookie);
      return res;
    }
  }

  const cookieHeader = req.headers.get("cookie") ?? null;
  const hasMockCookie = !!(cookieHeader && readCookieValue(cookieHeader, "mock_role"));
  const allowMock = SUPABASE_MOCK || (!IS_PROD && hasMockCookie);

  let supabaseAnon = null;
  if (!IS_TEST && !allowMock && SUPABASE_AVAILABLE) {
    supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
      if (error || !data?.session?.access_token) {
        return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
      }

      const res = NextResponse.json({ ok: true });
      setAuthCookies(res, data.session.access_token, data.session.expires_in, AUTH_COOKIE_NAME);
      return res;
    } catch (err) {
      console.error("Erro ao autenticar com Supabase:", err);
      return NextResponse.json({ error: "Erro interno ao autenticar" }, { status: 500 });
    }
  }

  if (!allowMock && !isPrismaConfigured()) {
    return NextResponse.json(
      { error: "Banco nao configurado (defina DATABASE_URL, POSTGRES_URL ou POSTGRES_PRISMA_URL)" },
      { status: 503 },
    );
  }

  let user = null;
  try {
    user = await validateUser(email, password, cookieHeader, allowMock);
  } catch (err) {
    if (isPrismaConfigError(err) || isPrismaDbError(err)) {
      const message = isPrismaSchemaError(err)
        ? "Banco sem schema. Rode as migracoes do Prisma."
        : "Banco nao configurado ou indisponivel (defina DATABASE_URL, POSTGRES_URL ou POSTGRES_PRISMA_URL).";
      return NextResponse.json({ error: message }, { status: 503 });
    }
    console.error("Erro ao autenticar:", err);
    return NextResponse.json({ error: "Erro interno ao autenticar" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }

  const sessionId = randomUUID();
  const redis = getRedis();

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify(user),
    { ex: 60 * 60 * 8 }, // 8 horas
  );

  const res = NextResponse.json({ ok: true });

  res.cookies.set("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return res;
}
