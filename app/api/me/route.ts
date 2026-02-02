import { NextResponse } from "next/server";

import type { AuthCompany } from "@/../packages/contracts/src/auth";
import { getAccessContext } from "@/lib/auth/session";
import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
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
    return {
      id: company.id,
      name: company.name ?? company.company_name ?? "Empresa",
      slug: company.slug,
      role,
      active: company.active ?? true,
      companyRole: rawRole ?? null,
      capabilities: link?.capabilities ?? undefined,
    };
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
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

export async function PATCH() {
  return NextResponse.json({ error: "Not implemented" }, { status: 405 });
}
