import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import { hashPasswordSha256, safeEqualHex } from "@/lib/passwordHash";
import { getRedis } from "@/lib/redis";
import {
  findLocalUserByEmailOrId,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
} from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";

const SESSION_TTL_SECONDS = 60 * 60 * 8;

function setCookie(res: NextResponse, name: string, value: string, maxAgeSeconds: number) {
  res.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

function buildAuthToken(payload: Record<string, unknown>) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(payload, secret, { expiresIn: `${SESSION_TTL_SECONDS}s` });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const login = typeof body?.login === "string" ? body.login.trim() : "";
    const userInput = typeof body?.user === "string" ? body.user.trim() : "";
    const usuarioInput = typeof body?.usuario === "string" ? body.usuario.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const identifier = userInput || usuarioInput || login;

    if (!identifier || !password) {
      return NextResponse.json({ error: "Usuario e senha obrigatorios" }, { status: 400 });
    }

    const user = await findLocalUserByEmailOrId(identifier);
    if (!user || user.active === false || user.status === "blocked") {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    const hashedInput = hashPasswordSha256(password);
    if (!safeEqualHex(hashedInput, user.password_hash)) {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    const [links, companies] = await Promise.all([
      listLocalLinksForUser(user.id),
      listLocalCompanies(),
    ]);
    const isGlobalAdmin = user.globalRole === "global_admin" || user.is_global_admin === true;
    const allowedCompanies = isGlobalAdmin
      ? companies
      : companies.filter((company) => links.some((link) => link.companyId === company.id));
    const requestedSlug =
      (typeof body?.clientSlug === "string" && body.clientSlug.trim()) ||
      (typeof body?.companySlug === "string" && body.companySlug.trim()) ||
      "";
    // Prioriza a empresa solicitada (quando permitida) para manter o contexto ativo do usuario.
    const requestedCompany =
      requestedSlug && allowedCompanies.length
        ? allowedCompanies.find((company) => company.slug === requestedSlug) ?? null
        : null;
    const activeCompany =
      requestedCompany ??
      allowedCompanies.find((company) => company.slug === user.default_company_slug) ??
      allowedCompanies[0] ??
      null;
    const activeLink = activeCompany
      ? links.find((link) => link.companyId === activeCompany.id) ?? null
      : null;
    const normalizedRole = normalizeLocalRole(activeLink?.role ?? user.role ?? null);
    const companyRole = normalizedRole ?? "user";
    const capabilities = resolveCapabilities({
      globalRole: isGlobalAdmin ? "global_admin" : null,
      companyRole: companyRole === "company_admin" ? "company_admin" : companyRole === "viewer" ? "viewer" : "user",
      membershipCapabilities: activeLink?.capabilities ?? null,
    });
    const effectiveRole = isGlobalAdmin ? "admin" : companyRole === "company_admin" ? "company" : "user";

    const sessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      companyId: activeCompany?.id ?? null,
      companySlug: activeCompany?.slug ?? null,
      role: effectiveRole,
      globalRole: isGlobalAdmin ? "global_admin" : null,
      companyRole,
      capabilities,
      isGlobalAdmin,
    };

    const sessionId = randomUUID();
    const redis = getRedis();
    await redis.set(`session:${sessionId}`, JSON.stringify(sessionPayload), { ex: SESSION_TTL_SECONDS });

    const authToken = buildAuthToken({
      sub: user.id,
      email: user.email,
      role: effectiveRole,
      globalRole: isGlobalAdmin ? "global_admin" : null,
      companyRole,
      capabilities,
      companyId: activeCompany?.id ?? null,
      companySlug: activeCompany?.slug ?? null,
      isGlobalAdmin,
    });
    const tokenToExpose = authToken ?? sessionId;
    const res = NextResponse.json({
      ok: true,
      session: {
        access_token: tokenToExpose,
        token_type: "Bearer",
        expires_in: SESSION_TTL_SECONDS,
      },
    });
    setCookie(res, "session_id", sessionId, SESSION_TTL_SECONDS);
    // Sempre expõe um token para manter compatibilidade no middleware.
    setCookie(res, "auth_token", tokenToExpose, SESSION_TTL_SECONDS);
    if (requestedCompany?.slug) {
      // Mantem o contexto de empresa escolhido (admin ou company) apos login.
      setCookie(res, "active_company_slug", requestedCompany.slug, SESSION_TTL_SECONDS);
    } else {
      // Limpa o contexto salvo quando o login nao especifica empresa.
      res.cookies.set("active_company_slug", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[LOGIN ERROR]", err);
    return NextResponse.json({ error: "Erro interno: " + message }, { status: 500 });
  }
}
