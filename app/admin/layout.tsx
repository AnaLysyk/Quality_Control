import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/lib/auth/session";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const pathname = headerStore.get("x-current-path") ?? "";
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

  const hasAdminAccess =
    access.isGlobalAdmin === true ||
    access.role === "leader_tc" ||
    access.role === "technical_support";
  const hasAccessRequestsAccess = hasPermissionAccess(
    resolveRoleDefaults(access.role),
    "access_requests",
    "view",
  );
  const canOpenAdminRoute =
    hasAdminAccess ||
    (hasAccessRequestsAccess &&
      (pathname.startsWith("/admin/access-requests") || pathname.startsWith("/admin/requests")));

  if (!canOpenAdminRoute) {
    const fallbackCompany = access.companySlug ?? access.companySlugs[0] ?? null;
    redirect(fallbackCompany ? `/empresas/${encodeURIComponent(fallbackCompany)}/home` : "/empresas");
  }

  return <>{children}</>;
}

