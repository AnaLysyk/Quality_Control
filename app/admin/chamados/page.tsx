import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getAccessContextFromStores } from "@/lib/auth/session";
import { isDevRole } from "@/lib/rbac/devAccess";

export default async function AdminChamadosRedirect() {
  const cookieStore = await cookies();
  const access = await getAccessContextFromStores(undefined, cookieStore);

  if (!access) {
    redirect("/login");
  }

  const isDev = access.isGlobalAdmin || isDevRole(access.role ?? undefined) || access.capabilities?.includes("*");
  redirect(isDev ? "/kanban-it" : "/meus-chamados");
}
