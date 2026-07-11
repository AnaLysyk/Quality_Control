import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/lib/auth/session";
import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

function hasAnyPermission(
  permissions: PermissionMatrix,
  moduleId: string,
  actions: string[],
) {
  return actions.some((action) => hasPermissionAccess(permissions, moduleId, action));
}

function canOpenAdminPath(pathname: string, permissions: PermissionMatrix) {
  if (pathname.startsWith("/admin/users/vinculos")) {
    return hasPermissionAccess(permissions, "relationships", "view");
  }

  if (
    pathname.startsWith("/admin/permissions") ||
    pathname.startsWith("/admin/users/permissions") ||
    pathname.startsWith("/admin/sistema/mapa")
  ) {
    return hasPermissionAccess(permissions, "permissions", "view");
  }

  if (pathname.startsWith("/admin/users")) {
    return hasAnyPermission(permissions, "users", ["view", "view_company", "view_all"]);
  }

  if (pathname.startsWith("/admin/clients")) {
    return hasPermissionAccess(permissions, "applications", "view");
  }

  if (
    pathname.startsWith("/admin/access-requests") ||
    pathname.startsWith("/admin/requests")
  ) {
    return hasPermissionAccess(permissions, "access_requests", "view");
  }

  if (pathname.startsWith("/admin/audit-logs")) {
    return hasPermissionAccess(permissions, "audit", "view");
  }

  if (pathname.startsWith("/admin/chamados")) {
    return (
      hasPermissionAccess(permissions, "support", "view") ||
      hasAnyPermission(permissions, "tickets", ["view", "view_own", "view_company", "view_all"])
    );
  }

  if (pathname.startsWith("/admin/brain")) {
    return hasPermissionAccess(permissions, "brain", "view");
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/home") ||
    pathname.startsWith("/admin/visao-geral") ||
    pathname.startsWith("/admin/dashboard")
  ) {
    return hasPermissionAccess(permissions, "dashboard", "view");
  }

  return false;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const pathname = headerStore.get("x-current-path") ?? "/admin";
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

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  const canOpenAdminRoute = canOpenAdminPath(pathname, permissionAccess.permissions);

  if (!canOpenAdminRoute) {
    const fallbackCompany = access.companySlug ?? access.companySlugs[0] ?? null;
    redirect(fallbackCompany ? `/empresas/${encodeURIComponent(fallbackCompany)}/home` : "/empresas");
  }

  return <>{children}</>;
}
