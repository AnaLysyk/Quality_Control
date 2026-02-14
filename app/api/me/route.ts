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
  const isGlobalAdmin = access.isGlobalAdmin === true;
  const normalizedRole = (access.role ?? "").toLowerCase();
  const normalizedCompanyRole = (access.companyRole ?? "").toLowerCase();
  // Precedência de roles: global > company > link
  // it_dev ⇒ ADMIN? Confirmar regra de produto!
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

  // O(1) lookup de link por companyId
  const linkByCompanyId = new Map(links.map((l) => [l.companyId, l]));

  const companiesResponse: AuthCompany[] = allowedCompanies.map((company) => {
    const link = linkByCompanyId.get(company.id);
    const rawRole = normalizeLocalRole(link?.role ?? null);
    // it_dev ⇒ ADMIN? Confirmar regra de produto!
    const role = hasPrivilegedAccess || rawRole === "company_admin" ? "ADMIN" : "USER";
    return {
      id: company.id,
      name: company.name ?? company.company_name ?? "Empresa",
      slug: company.slug,
      role,
      active: company.active ?? true,
      createdAt: pickCreatedAt(company),
      companyRole: rawRole ?? null,
      capabilities: link?.capabilities ?? undefined,
    };
  });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? null,
        role: access.role ?? null,
        globalRole: access.globalRole ?? null,
        companyRole: access.companyRole ?? null,
        capabilities: access.capabilities ?? [],
        clientId: access.companyId ?? null,
        clientSlug: access.companySlug ?? null,
        defaultClientSlug: user.default_company_slug ?? access.companySlug ?? null,
        clientSlugs: access.companySlugs ?? [],
        isGlobalAdmin: access.isGlobalAdmin === true,
      },
      companies: companiesResponse,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=20",
      },
    },
  );
}
// Helper para unificar acesso a createdAt/created_at
function pickCreatedAt(c: any): string | null {
  if (typeof c.createdAt === "string") return c.createdAt;
  if (typeof c.created_at === "string") return c.created_at;
  return null;
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
  if (!trimmed) return null;
  // Regex leve para validar formato de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function PATCH(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return errorResponse(401, "NO_SESSION", "Nao autorizado");
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const hasName = typeof body?.name === "string";
  const hasEmail = typeof body?.email === "string";
  const hasPhone = typeof body?.phone === "string";

  // Só passar string ou undefined, nunca null
  const name = hasName ? sanitizeText(body?.name, 120) || undefined : undefined;
  const email = hasEmail ? normalizeEmail(body?.email) || undefined : undefined;
  const phone = (() => {
    if (!hasPhone) return undefined;
    const trimmed = String(body?.phone ?? "").trim();
    return trimmed ? trimmed.slice(0, 30) : undefined;
  })();

  if (hasName && !name) {
    return errorResponse(400, "INVALID_NAME", "Nome invalido");
  }
  if (!name && !email && !hasPhone) {
    return errorResponse(400, "NO_CHANGES", "Nenhuma alteracao informada");
  }

  const user = await getLocalUserById(access.userId);
  if (!user) {
    return errorResponse(404, "USER_NOT_FOUND", "Usuario nao encontrado");
  }

  if (email && email !== user.email) {
    const existing = await findLocalUserByEmailOrId(email);
    if (existing && existing.id !== user.id) {
      return errorResponse(409, "EMAIL_IN_USE", "E-mail ja em uso");
    }
  }

  const updated = await updateLocalUser(user.id, {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(hasPhone ? { phone } : {}),
  });

  if (!updated) {
    return errorResponse(500, "UPDATE_FAILED", "Nao foi possivel atualizar");
  }

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone ?? null,
      },
    },
    { status: 200 },
  );
}
