import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole } from "@/lib/auth/localStore";
import { resolveVisibleCompanies } from "@/lib/companyVisibility";

export const revalidate = 0;

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(access.userId),
    listLocalCompanies(),
  ]);
  const allowedCompanies = resolveVisibleCompanies(companies, {
    user: {
      role: access.role ?? null,
      companyRole: access.companyRole ?? null,
      userOrigin: access.userOrigin ?? null,
      isGlobalAdmin: access.isGlobalAdmin === true,
      companySlug: access.companySlug ?? null,
      clientSlug: access.companySlug ?? null,
      companySlugs: access.companySlugs ?? [],
      clientSlugs: access.companySlugs ?? [],
    },
    links,
    preferredSlug: access.companySlug ?? null,
  });
  const isPrivilegedCompanyRole =
    access.isGlobalAdmin === true ||
    access.role === "leader_tc" ||
    access.companyRole === "leader_tc" ||
    access.role === "technical_support" ||
    access.companyRole === "technical_support";

  const items = allowedCompanies.map((company) => {
    const link = links.find((item) => item.companyId === company.id);
    const normalized = normalizeLocalRole(link?.role ?? null);
    const createdAt =
      (typeof (company as { createdAt?: string | null }).createdAt === "string"
        ? (company as { createdAt?: string | null }).createdAt
        : null) ??
      (typeof (company as { created_at?: string | null }).created_at === "string"
        ? (company as { created_at?: string | null }).created_at
        : null);
    return {
      client_id: company.id,
      client_name: company.name ?? company.company_name ?? "Empresa",
      client_slug: company.slug,
      client_active: company.active ?? true,
      role: isPrivilegedCompanyRole || normalized === "empresa" ? "ADMIN" : "USER",
      link_active: true,
      created_at: createdAt,
      companyRole: normalized ?? null,
      capabilities: link?.capabilities ?? undefined,
    };
  });

  return NextResponse.json({ items });
}
