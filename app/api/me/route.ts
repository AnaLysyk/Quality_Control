import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import type { AuthCompany } from "@/../packages/contracts/src/auth";
import { addAuditLogSafe } from "@/data/auditLogRepository";
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
import { isAvatarKey } from "@/lib/avatarCatalog";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

const AVATAR_BASE_DIR = path.join(process.cwd(), "data", "s3");

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
      logoUrl:
        typeof (company as { logo_url?: string | null }).logo_url === "string"
          ? (company as { logo_url?: string | null }).logo_url
          : null,
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
      active: user.active !== false,
      status: user.active === false ? "inactive" : user.status ?? "active",
      jobTitle: user.job_title ?? null,
      job_title: user.job_title ?? null,
      linkedinUrl: user.linkedin_url ?? null,
      linkedin_url: user.linkedin_url ?? null,
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
  }, { headers: NO_STORE_HEADERS });
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

function extractObjectKey(avatarUrl?: string | null) {
  if (!avatarUrl) return null;
  const marker = "/api/s3/object?key=";
  const idx = avatarUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = avatarUrl.slice(idx + marker.length).trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function resolveAvatarTarget(key: string) {
  const target = path.resolve(AVATAR_BASE_DIR, key);
  const base = path.resolve(AVATAR_BASE_DIR);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

export async function PATCH(req: Request) {
  try {
    const access = await getAccessContext(req);
    if (!access) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const hasName = typeof body?.name === "string";
    const hasEmail = typeof body?.email === "string";
    const hasUser = typeof body?.user === "string" || typeof body?.username === "string";
    const hasPhone = typeof body?.phone === "string";
    const hasFullName = typeof body?.full_name === "string" || typeof body?.fullName === "string";
    const hasAvatarKey = typeof body?.avatar_key === "string" || typeof body?.avatarKey === "string";
    const hasAvatarUrl = hasOwn(body, "avatar_url") || hasOwn(body, "avatarUrl");
    const hasJobTitle = hasOwn(body, "job_title") || hasOwn(body, "jobTitle");
    const hasLinkedinUrl = hasOwn(body, "linkedin_url") || hasOwn(body, "linkedinUrl");

    const name = hasName ? sanitizeText(body?.name, 120) : null;
    const email = hasEmail ? normalizeEmail(body?.email) : null;
    const login = hasUser ? normalizeLogin(body?.user ?? body?.username) : null;
    const fullName = hasFullName ? sanitizeText(body?.full_name ?? body?.fullName, 160) : null;
    const avatarKey = hasAvatarKey ? String(body?.avatar_key ?? body?.avatarKey ?? "").trim() : null;
    const avatarUrl = (() => {
      if (!hasAvatarUrl) return undefined;
      const raw = body?.avatar_url ?? body?.avatarUrl;
      if (raw == null) return null;
      if (typeof raw !== "string") return null;
      const trimmed = raw.trim();
      return trimmed || null;
    })();
    const phone = (() => {
      if (!hasPhone) return null;
      const trimmed = String(body?.phone ?? "").trim();
      return trimmed ? trimmed : null;
    })();
    const jobTitle = (() => {
      if (!hasJobTitle) return undefined;
      const raw = body?.job_title ?? body?.jobTitle;
      if (raw == null) return null;
      if (typeof raw !== "string") return null;
      const trimmed = raw.trim();
      return trimmed ? trimmed.slice(0, 120) : null;
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
    if (hasEmail && !email) {
      return NextResponse.json({ error: "E-mail obrigatorio" }, { status: 400 });
    }
    if (hasFullName && !fullName) {
      return NextResponse.json({ error: "Nome completo invalido" }, { status: 400 });
    }
    if (hasAvatarKey && avatarKey && !isAvatarKey(avatarKey)) {
      return NextResponse.json({ error: "Avatar invalido" }, { status: 400 });
    }
    if (!name && !email && !hasUser && !hasPhone && !hasFullName && !hasAvatarKey && !hasAvatarUrl && !hasJobTitle && !hasLinkedinUrl) {
      return NextResponse.json({ error: "Nenhuma alteracao informada" }, { status: 400 });
    }

    const user = await getLocalUserById(access.userId);
    if (!user) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
    }

    const previousAvatarKey = extractObjectKey(user.avatar_url);

    if (email && email !== user.email) {
      const existing = await findLocalUserByEmailOrId(email);
      if (existing && existing.id !== user.id) {
        return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
      }
    }
    if (login && login !== (user.user ?? user.email)) {
      const users = await listLocalUsers();
      if (users.some((item) => item.id !== user.id && (item.user ?? item.email) === login)) {
        return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
      }
    }

    let updated = null;
    try {
      const resolvedName = fullName ?? name ?? null;
      updated = await updateLocalUser(user.id, {
        ...(hasFullName ? { full_name: fullName } : {}),
        ...(resolvedName ? { name: resolvedName } : {}),
        ...(email ? { email } : {}),
        ...(hasUser ? { user: login ?? "" } : {}),
        ...(hasAvatarKey ? { avatar_key: avatarKey || null } : {}),
        ...(hasAvatarUrl ? { avatar_url: avatarUrl ?? null } : {}),
        ...(hasJobTitle ? { job_title: jobTitle ?? null } : {}),
        ...(hasLinkedinUrl ? { linkedin_url: linkedinUrl ?? null } : {}),
        ...(hasPhone ? { phone } : {}),
      });
    } catch (error) {
      const code = error && typeof error === "object" ? (error as { code?: string }).code : null;
      if (code === "DUPLICATE_EMAIL") {
        return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
      }
      if (code === "DUPLICATE_USER") {
        return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
      }
      throw error;
    }

    if (!updated) {
      return NextResponse.json({ error: "Nao foi possivel atualizar" }, { status: 500 });
    }

    addAuditLogSafe({
      action: "user.profile.updated",
      entityType: "user",
      entityId: user.id,
      entityLabel: updated.email ?? null,
      actorUserId: user.id,
      actorEmail: updated.email ?? null,
      metadata: {
        fieldsUpdated: [
          ...(hasFullName ? ["full_name"] : []),
          ...(hasName || hasFullName ? ["name"] : []),
          ...(email ? ["email"] : []),
          ...(hasUser ? ["user"] : []),
          ...(hasPhone ? ["phone"] : []),
          ...(hasJobTitle ? ["job_title"] : []),
          ...(hasLinkedinUrl ? ["linkedin_url"] : []),
          ...(hasAvatarKey || hasAvatarUrl ? ["avatar"] : []),
        ],
      },
    });

    const nextAvatarKey = extractObjectKey(updated.avatar_url);
    if (previousAvatarKey && previousAvatarKey !== nextAvatarKey) {
      const previousTarget = resolveAvatarTarget(previousAvatarKey);
      if (previousTarget) {
        await fs.rm(previousTarget, { force: true }).catch(() => undefined);
      }
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
          active: updated.active !== false,
          status: updated.active === false ? "inactive" : updated.status ?? "active",
          jobTitle: updated.job_title ?? null,
          job_title: updated.job_title ?? null,
          linkedinUrl: updated.linkedin_url ?? null,
          linkedin_url: updated.linkedin_url ?? null,
          fullName:
            (typeof (updated as { full_name?: string | null }).full_name === "string"
              ? (updated as { full_name?: string | null }).full_name
              : null) ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Nao foi possivel atualizar os dados";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await getAccessContext(req);
    if (!access) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const normalizedRole = (access.role ?? "").trim().toLowerCase();
    const normalizedCompanyRole = (access.companyRole ?? "").trim().toLowerCase();
    const canDeleteDirectly =
      access.isGlobalAdmin === true ||
      normalizedRole === "admin" ||
      normalizedRole === "global_admin" ||
      normalizedRole === "it_dev" ||
      normalizedCompanyRole === "it_dev";
    if (!canDeleteDirectly) {
      return NextResponse.json({ error: "Somente admin ou global podem deletar o perfil diretamente" }, { status: 403 });
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
      return NextResponse.json({ error: "Nao foi possivel deletar o usuario" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Nao foi possivel deletar o usuario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
