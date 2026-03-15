import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  const req = new Request(`http://${host}/admin`, {
    headers: {
      cookie: cookieHeader,
    },
  });

  const access = await getAccessContext(req);
  if (!access) {
    redirect("/login?next=%2Fadmin");
  }

  const isAdmin =
    access.isGlobalAdmin === true ||
    access.role === "admin" ||
    access.role === "global_admin";
  if (!isAdmin) {
    const fallbackCompany = access.companySlug ?? access.companySlugs[0] ?? null;
    redirect(fallbackCompany ? `/empresas/${encodeURIComponent(fallbackCompany)}/home` : "/empresas");
  }

  return <>{children}</>;
}
