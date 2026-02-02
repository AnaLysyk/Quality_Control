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
  const allowedCompanies = isGlobalAdmin
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));

  const items = allowedCompanies.map((company) => {
    const link = links.find((item) => item.companyId === company.id);
    const normalized = normalizeLocalRole(link?.role ?? null);
    return {
      client_id: company.id,
      client_name: company.name ?? company.company_name ?? "Empresa",
      client_slug: company.slug,
      client_active: company.active ?? true,
      role: isGlobalAdmin || normalized === "company_admin" ? "ADMIN" : "USER",
      link_active: true,
      companyRole: normalized ?? null,
      capabilities: link?.capabilities ?? undefined,
    };
  });

  return NextResponse.json({ items });
}
