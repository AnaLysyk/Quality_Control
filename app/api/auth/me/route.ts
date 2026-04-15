import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById } from "@/lib/auth/localStore";
import { isAvatarKey } from "@/lib/avatarCatalog";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const revalidate = 0;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ user: null, error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return errorResponse(401, "NO_SESSION", "Não autorizado");
  }

  const user = await getLocalUserById(access.userId);
  if (!user) {
    return errorResponse(401, "USER_NOT_FOUND", "Usuário não encontrado");
  }

  const displayName =
    (typeof user.full_name === "string" ? user.full_name.trim() : "") ||
    (typeof user.name === "string" ? user.name.trim() : "") ||
    user.email;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: displayName,
      fullName: typeof user.full_name === "string" ? user.full_name : null,
      avatarKey: isAvatarKey(user.avatar_key) ? user.avatar_key : null,
      avatarUrl: user.avatar_url ?? null,
      role: access.role ?? null,
      globalRole: access.globalRole ?? null,
      companyRole: access.companyRole ?? null,
      capabilities: access.capabilities ?? [],
      companyId: access.companyId ?? null,
      clientId: access.companyId ?? null,
      companySlug: access.companySlug ?? null,
      clientSlug: access.companySlug ?? null,
      isGlobalAdmin: access.isGlobalAdmin === true,
    },
  }, { headers: NO_STORE_HEADERS });
}
