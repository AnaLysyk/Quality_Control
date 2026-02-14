import HomeContent from "./home/HomeContent";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAccessContextFromStores, type AccessContext } from "@/lib/auth/session";

function resolveLandingRoute(access: AccessContext, activeCompanySlug: string | null): string | null {
  const companySlugs = Array.isArray(access.companySlugs) ? access.companySlugs.filter(Boolean) : [];
  const normalizedActive =
    activeCompanySlug && companySlugs.includes(activeCompanySlug) ? activeCompanySlug : null;
  const isAdmin = access.isGlobalAdmin || access.role === "admin";

  if (isAdmin) {
    if (normalizedActive) {
      return `/empresas/${encodeURIComponent(normalizedActive)}/home`;
    }
    return "/admin";
  }

  const resolvedSlug =
    normalizedActive ??
    (companySlugs.includes(access.companySlug ?? "") ? access.companySlug : null) ??
    companySlugs[0] ??
    null;

  if (resolvedSlug) {
    return `/empresas/${encodeURIComponent(resolvedSlug)}/home`;
  }

  if (companySlugs.length === 0) {
    return "/empresas";
  }

  return null;
}

export default async function Page() {
  const cookieStore = await cookies();
  const activeCompanyCookie = cookieStore.get("active_company_slug")?.value?.trim() ?? null;

  const access = await getAccessContextFromStores(undefined, cookieStore);
  if (!access) redirect("/login");

  const destination = resolveLandingRoute(access, activeCompanyCookie);
  if (destination) {
    redirect(destination);
  }

  return <HomeContent />;
}
