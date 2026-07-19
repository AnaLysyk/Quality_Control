import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/backend/auth/session";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { resolvePermissionAccessForUser } from "@/backend/serverPermissionAccess";

async function buildRequestFromIncomingHeaders() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const pathname = headerStore.get("x-current-path") ?? "/";
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  return new Request(`http://${host}${pathname}`, {
    headers: { cookie: cookieHeader },
  });
}

/**
 * Guarda de página server-side reutilizável: autentica, resolve a matriz de
 * permissões efetiva e redireciona ANTES de renderizar `children`, para telas
 * fora de app/admin/** (que já tem sua própria guarda em app/admin/layout.tsx).
 * Use a partir de um layout.tsx (Server Component) da rota protegida.
 */
export async function requireScreenAccess(
  moduleId: string,
  action: string,
  options: { loginNext?: string; fallbackPath?: string } = {},
) {
  const req = await buildRequestFromIncomingHeaders();
  const access = await getAccessContext(req);
  if (!access) {
    const next = options.loginNext ? `?next=${encodeURIComponent(options.loginNext)}` : "";
    redirect(`/login${next}`);
  }

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  if (!hasPermissionAccess(permissionAccess.permissions, moduleId, action)) {
    const fallbackCompany = access.companySlug ?? access.companySlugs[0] ?? null;
    redirect(
      options.fallbackPath ??
        (fallbackCompany ? `/empresas/${encodeURIComponent(fallbackCompany)}/home` : "/empresas"),
    );
  }

  return access;
}
