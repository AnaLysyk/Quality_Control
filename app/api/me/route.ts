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
  if (!trimmed) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
  return trimmed;
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

  const name = hasName ? sanitizeText(body?.name, 120) : null;
  const email = hasEmail ? normalizeEmail(body?.email) : null;
  const phone = (() => {
    if (!hasPhone) return null;
    const trimmed = String(body?.phone ?? "").trim();
    return trimmed ? trimmed : null;
  })();

  if (hasName && !name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 });
  }
  if (hasEmail && !email) {
    return NextResponse.json({ error: "E-mail invalido" }, { status: 400 });
  }

  if (!name && !email && !hasPhone) {
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

  const updated = await updateLocalUser(user.id, {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(hasPhone ? { phone } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar" }, { status: 500 });
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
