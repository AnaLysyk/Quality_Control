
import HomeContent from "./home/HomeContent";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getAccessContext } from "@/lib/auth/session";

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

  const isAdmin = access.isGlobalAdmin || access.role === "admin";
  if (isAdmin) {
    const requestedCompany =
      activeCompanyCookie && access.companySlugs.includes(activeCompanyCookie) ? activeCompanyCookie : null;
    if (requestedCompany) {
      redirect(`/empresas/${requestedCompany}/home`);
    }
    redirect("/admin");
  }

  const companySlug = access.companySlug ?? access.companySlugs[0] ?? null;
  if (companySlug) {
    redirect(`/empresas/${companySlug}/home`);
  }

  return <HomeContent />;
}
