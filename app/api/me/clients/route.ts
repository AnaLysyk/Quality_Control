import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole } from "@/lib/auth/localStore";

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(access.userId),
    listLocalCompanies(),
  ]);
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
      role: hasPrivilegedAccess || normalized === "company_admin" ? "ADMIN" : "USER",
      link_active: true,
      created_at: createdAt,
      companyRole: normalized ?? null,
      capabilities: link?.capabilities ?? undefined,
    };
  });

  return NextResponse.json({ items });
}
