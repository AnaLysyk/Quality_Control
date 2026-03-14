import { NextResponse } from "next/server";

import type { AuthCompany } from "@/../packages/contracts/src/auth";
import { getAccessContext } from "@/lib/auth/session";
import {
  findLocalUserByEmailOrId,
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  listLocalUsers,
  normalizeLocalRole,
  updateLocalUser,
} from "@/lib/auth/localStore";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { user: null, companies: [], error: { code, message } },
    { status },
  );
}

function sanitizeText(value: unknown, max = 255): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function normalizeLogin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function hasOwn(obj: Record<string, unknown> | null, key: string) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function buildUserPayload(user: Awaited<ReturnType<typeof getLocalUserById>>, access: Awaited<ReturnType<typeof getAccessContext>>) {
  if (!user || !access) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    user: user.user ?? user.email,
    username: user.user ?? user.email,
    phone: user.phone ?? null,
    fullName: user.name ?? null,
    avatarKey: null,
    avatarUrl: user.avatar_url ?? null,
    active: user.active !== false,
    status: user.active === false ? "inactive" : user.status ?? "active",
    jobTitle: user.job_title ?? null,
    job_title: user.job_title ?? null,
    linkedinUrl: user.linkedin_url ?? null,
    linkedin_url: user.linkedin_url ?? null,
    role: access.role ?? null,
    globalRole: access.globalRole ?? null,
    companyRole: access.companyRole ?? null,
    capabilities: access.capabilities ?? [],
    companyId: access.companyId ?? null,
    clientId: access.companyId ?? null,
    companySlug: access.companySlug ?? null,
    clientSlug: access.companySlug ?? null,
    defaultClientSlug: user.default_company_slug ?? access.companySlug ?? null,
    clientSlugs: access.companySlugs ?? [],
    isGlobalAdmin: access.isGlobalAdmin === true,
  };
}

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return errorResponse(401, "NO_SESSION", "Nao autorizado");
  }

  const user = await getLocalUserById(access.userId);
  if (!user) {
    return errorResponse(401, "USER_NOT_FOUND", "Usuario nao encontrado");
  }

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(user.id),
    listLocalCompanies(),
  ]);
  const isGlobalAdmin = access.isGlobalAdmin === true;
  const allowedCompanies = isGlobalAdmin
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));

  const companiesResponse: AuthCompany[] = allowedCompanies.map((company) => {
    const link = links.find((item) => item.companyId === company.id);
    const rawRole = normalizeLocalRole(link?.role ?? null);
    const role = isGlobalAdmin || rawRole === "company_admin" ? "ADMIN" : "USER";
    const createdAt =
      (typeof (company as { createdAt?: string | null }).createdAt === "string"
        ? (company as { createdAt?: string | null }).createdAt
        : null) ??
      (typeof (company as { created_at?: string | null }).created_at === "string"
        ? (company as { created_at?: string | null }).created_at
        : null);

    return {
      id: company.id,
      name: company.name ?? company.company_name ?? "Empresa",
      slug: company.slug,
      role,
      active: company.active ?? true,
      createdAt,
      companyRole: rawRole ?? null,
      capabilities: link?.capabilities ?? undefined,
    };
  });

  return NextResponse.json({
    user: buildUserPayload(user, access),
    companies: companiesResponse,
  });
}

export async function PATCH(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const hasName = typeof body?.name === "string";
  const hasFullName = typeof body?.full_name === "string" || typeof body?.fullName === "string";
  const hasEmail = typeof body?.email === "string";
  const hasUser = typeof body?.user === "string" || typeof body?.username === "string";
  const hasPhone = typeof body?.phone === "string";
  const hasAvatarUrl = hasOwn(body, "avatar_url") || hasOwn(body, "avatarUrl");
  const hasJobTitle = hasOwn(body, "job_title") || hasOwn(body, "jobTitle");
  const hasLinkedinUrl = hasOwn(body, "linkedin_url") || hasOwn(body, "linkedinUrl");

  const name = hasName ? sanitizeText(body?.name, 120) : null;
  const fullName = hasFullName ? sanitizeText(body?.full_name ?? body?.fullName, 120) : null;
  const email = hasEmail ? normalizeEmail(body?.email) : null;
  const login = hasUser ? normalizeLogin(body?.user ?? body?.username) : null;
  const phone = hasPhone ? sanitizeText(body?.phone, 40) : undefined;
  const avatarUrl = (() => {
    if (!hasAvatarUrl) return undefined;
    const raw = body?.avatar_url ?? body?.avatarUrl;
    if (raw == null) return null;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed || null;
  })();
  const jobTitle = (() => {
    if (!hasJobTitle) return undefined;
    const raw = body?.job_title ?? body?.jobTitle;
    if (raw == null) return null;
    return sanitizeText(raw, 120);
  })();
  const linkedinUrl = (() => {
    if (!hasLinkedinUrl) return undefined;
    const raw = body?.linkedin_url ?? body?.linkedinUrl;
    if (raw == null) return null;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed || null;
  })();

  if (hasName && !name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 });
  }
  if (hasFullName && !fullName) {
    return NextResponse.json({ error: "Nome completo invalido" }, { status: 400 });
  }
  if (hasEmail && !email) {
    return NextResponse.json({ error: "E-mail obrigatorio" }, { status: 400 });
  }
  if (
    !hasName &&
    !hasFullName &&
    !hasEmail &&
    !hasUser &&
    !hasPhone &&
    !hasAvatarUrl &&
    !hasJobTitle &&
    !hasLinkedinUrl
  ) {
    return NextResponse.json({ error: "Nenhuma alteracao informada" }, { status: 400 });
  }

  const user = await getLocalUserById(access.userId);
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (email && email !== user.email) {
    const existing = await findLocalUserByEmailOrId(email);
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "E-mail ja em uso" }, { status: 409 });
    }
  }

  if (login && login !== (user.user ?? user.email)) {
    const users = await listLocalUsers();
    if (users.some((item) => item.id !== user.id && (item.user ?? item.email) === login)) {
      return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
    }
  }

  const updated = await updateLocalUser(user.id, {
    ...((fullName ?? name) ? { name: fullName ?? name ?? user.name } : {}),
    ...(email ? { email } : {}),
    ...(hasUser ? { user: login ?? "" } : {}),
    ...(hasPhone ? { phone: phone ?? null } : {}),
    ...(hasAvatarUrl ? { avatar_url: avatarUrl ?? null } : {}),
    ...(hasJobTitle ? { job_title: jobTitle ?? null } : {}),
    ...(hasLinkedinUrl ? { linkedin_url: linkedinUrl ?? null } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      user: buildUserPayload(updated, access),
    },
    { status: 200 },
  );
}

export async function DELETE(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const user = await getLocalUserById(access.userId);
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const updated = await updateLocalUser(user.id, {
    active: false,
    status: "blocked",
  });

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel desativar o usuario" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
