import { NextResponse } from "next/server";

import type { AuthCompany } from "@/../packages/contracts/src/auth";
import { getAccessContext } from "@/lib/auth/session";
import {
  findLocalUserByEmailOrId,
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
  updateLocalUser,
} from "@/lib/auth/localStore";
import { isAvatarKey } from "@/lib/avatarCatalog";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { user: null, companies: [], error: { code, message } },
    { status },
  );
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
  const permissionAccess = await resolvePermissionAccessForUser(user.id);
  const isGlobalAdmin = access.isGlobalAdmin === true;
  const normalizedRole = (access.role ?? "").toLowerCase();
  const normalizedCompanyRole = (access.companyRole ?? "").toLowerCase();
  const hasDeveloperPrivileges = normalizedRole === "it_dev" || normalizedCompanyRole === "it_dev";
  const hasPrivilegedAccess = isGlobalAdmin || hasDeveloperPrivileges;
  const allowedSlugSet = new Set(
    (access.companySlugs ?? [])
      .map((slug) => (typeof slug === "string" ? slug.trim().toLowerCase() : ""))
      .filter((slug): slug is string => slug.length > 0),
  );
  const allowedCompanies = hasPrivilegedAccess
    ? companies
    : companies.filter((company) => {
        const slug = typeof company.slug === "string" ? company.slug.trim().toLowerCase() : "";
        if (slug && allowedSlugSet.has(slug)) return true;
        return links.some((link) => link.companyId === company.id);
      });

  const companiesResponse: AuthCompany[] = allowedCompanies.map((company) => {
    const link = links.find((item) => item.companyId === company.id);
    const rawRole = normalizeLocalRole(link?.role ?? null);
    const role = hasPrivilegedAccess || rawRole === "company_admin" ? "ADMIN" : "USER";
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

  const displayName =
    (typeof (user as { full_name?: string | null }).full_name === "string"
      ? (user as { full_name?: string | null }).full_name?.trim()
      : "") ||
    (typeof user.name === "string" ? user.name.trim() : "") ||
    user.email;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: displayName,
      user: user.user ?? user.email,
      username: user.user ?? user.email,
      phone: user.phone ?? null,
      avatarKey: isAvatarKey(user.avatar_key) ? user.avatar_key : null,
      avatarUrl: user.avatar_url ?? null,
      fullName:
        (typeof (user as { full_name?: string | null }).full_name === "string"
          ? (user as { full_name?: string | null }).full_name
          : null) ?? null,
      role: access.role ?? null,
      globalRole: access.globalRole ?? null,
      companyRole: access.companyRole ?? null,
      capabilities: access.capabilities ?? [],
      permissions: permissionAccess.permissions,
      permissionRole: permissionAccess.roleKey,
      clientId: access.companyId ?? null,
      clientSlug: access.companySlug ?? null,
      defaultClientSlug: user.default_company_slug ?? access.companySlug ?? null,
      clientSlugs: access.companySlugs ?? [],
      isGlobalAdmin: access.isGlobalAdmin === true,
    },
    companies: companiesResponse,
  });
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

export async function PATCH(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const hasName = typeof body?.name === "string";
  const hasEmail = typeof body?.email === "string";
  const hasPhone = typeof body?.phone === "string";
  const hasFullName = typeof body?.full_name === "string" || typeof body?.fullName === "string";
  const hasAvatarKey = typeof body?.avatar_key === "string" || typeof body?.avatarKey === "string";

  const name = hasName ? sanitizeText(body?.name, 120) : null;
  const email = hasEmail ? normalizeEmail(body?.email) : null;
  const fullName = hasFullName ? sanitizeText(body?.full_name ?? body?.fullName, 160) : null;
  const avatarKey = hasAvatarKey ? String(body?.avatar_key ?? body?.avatarKey ?? "").trim() : null;
  const phone = (() => {
    if (!hasPhone) return null;
    const trimmed = String(body?.phone ?? "").trim();
    return trimmed ? trimmed : null;
  })();

  if (hasName && !name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 });
  }
  if (hasFullName && !fullName) {
    return NextResponse.json({ error: "Nome completo invalido" }, { status: 400 });
  }
  if (hasAvatarKey && avatarKey && !isAvatarKey(avatarKey)) {
    return NextResponse.json({ error: "Avatar invalido" }, { status: 400 });
  }
  if (!name && !email && !hasPhone && !hasFullName && !hasAvatarKey) {
    return NextResponse.json({ error: "Nenhuma alteracao informada" }, { status: 400 });
  }

  const user = await getLocalUserById(access.userId);
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (email && email !== user.email) {
    const existing = await findLocalUserByEmailOrId(email);
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
    }
  }

  let updated = null;
  try {
    updated = await updateLocalUser(user.id, {
      ...(hasFullName ? { full_name: fullName } : {}),
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(hasAvatarKey ? { avatar_key: avatarKey || null } : {}),
      ...(hasPhone ? { phone } : {}),
    });
  } catch (error) {
    const code = error && typeof error === "object" ? (error as { code?: string }).code : null;
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
    }
    throw error;
  }

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar" }, { status: 500 });
  }

  const updatedDisplayName =
    (typeof (updated as { full_name?: string | null }).full_name === "string"
      ? (updated as { full_name?: string | null }).full_name?.trim()
      : "") ||
    (typeof updated.name === "string" ? updated.name.trim() : "") ||
    updated.email;

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updatedDisplayName,
        user: updated.user ?? updated.email,
        username: updated.user ?? updated.email,
        phone: updated.phone ?? null,
        avatarKey: isAvatarKey(updated.avatar_key) ? updated.avatar_key : null,
        avatarUrl: updated.avatar_url ?? null,
        fullName:
          (typeof (updated as { full_name?: string | null }).full_name === "string"
            ? (updated as { full_name?: string | null }).full_name
            : null) ?? null,
      },
    },
    { status: 200 },
  );
}
