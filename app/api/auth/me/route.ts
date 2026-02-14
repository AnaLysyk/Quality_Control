import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById } from "@/lib/auth/localStore";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ user: null, error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return errorResponse(401, "NO_SESSION", "Nao autorizado");
  }

  const user = await getLocalUserById(access.userId);
  if (!user || user.active === false || user.status === "blocked") {
    return errorResponse(401, "USER_INVALID", "Usuario indisponivel");
  }

  const capabilities = Array.isArray(access.capabilities) ? access.capabilities : [];

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: access.role ?? null,
      globalRole: access.globalRole ?? null,
      companyRole: access.companyRole ?? null,
      capabilities,
      companyId: access.companyId ?? null,
      // Mantem campos client* por compatibilidade com clientes legados.
      clientId: access.companyId ?? null,
      companySlug: access.companySlug ?? null,
      clientSlug: access.companySlug ?? null,
      isGlobalAdmin: access.isGlobalAdmin === true,
    },
  });

  res.headers.set("Cache-Control", "no-store");
  return res;
}
