export const dynamic = "force-dynamic";


import HomeContent from "./home/HomeContent";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { normalizeAuthenticatedUser } from "@/lib/auth/normalizeAuthenticatedUser";
import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById } from "@/lib/auth/localStore";
import { buildCompanyPathForAccess, resolveCompanyRouteAccessInput } from "@/lib/companyRoutes";

export default async function Page() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
  const activeCompanyCookie = cookieStore.get("active_company_slug")?.value?.trim() ?? null;
  const req = new Request(`http://${host}/`, {
    headers: {
      cookie: cookieHeader,
    },
  });

  const access = await getAccessContext(req);
  if (!access) redirect("/login");
  const user = await getLocalUserById(access.userId);
  const routeUser = {
    ...(user ?? {}),
    role: access.role ?? null,
    companyRole: access.companyRole ?? null,
    user_origin: user?.user_origin ?? null,
    isGlobalAdmin: access.isGlobalAdmin,
    companySlug: access.companySlug ?? null,
    companySlugs: access.companySlugs ?? [],
    default_company_slug: user?.default_company_slug ?? null,
  };
  const normalizedUser = normalizeAuthenticatedUser(routeUser);

  const requestedCompany =
    activeCompanyCookie && access.companySlugs.includes(activeCompanyCookie) ? activeCompanyCookie : null;
  const companySlug =
    requestedCompany ??
    normalizedUser.primaryCompanySlug ??
    normalizedUser.defaultCompanySlug ??
    access.companySlugs[0] ??
    null;
  if (companySlug) {
    redirect(
      buildCompanyPathForAccess(
        companySlug,
        "home",
        resolveCompanyRouteAccessInput({
          user: routeUser,
          normalizedUser,
          companyCount: access.companySlugs.length,
          clientSlug: companySlug,
        }),
      ),
    );
  }

  const isAdmin = access.isGlobalAdmin || access.role === "leader_tc" || access.role === "technical_support";
  if (isAdmin) {
    redirect("/admin");
  }

  return <HomeContent />;
}
