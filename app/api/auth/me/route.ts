import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { buildCurrentUserResponse } from "@/lib/core/session/currentUserResponse";
import { getLocalUserById, findLocalCompanyById, findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { isAvatarKey } from "@/lib/avatarCatalog";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

export const revalidate = 0;

const PLATFORM_COMPANY_SLUG = process.env.PLATFORM_COMPANY_SLUG || "testing-company";

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

  let companyLogoUrl: string | null = null;
  try {
    if (access.companyId) {
      const company = await findLocalCompanyById(access.companyId);
      companyLogoUrl = (typeof company?.logo_url === "string" ? company.logo_url : null) ?? null;
    } else {
      const platformCompany = await findLocalCompanyBySlug(PLATFORM_COMPANY_SLUG);
      companyLogoUrl = (typeof platformCompany?.logo_url === "string" ? platformCompany.logo_url : null) ?? null;
    }
  } catch {
    // non-critical: logo fallback handled by client
  }

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  const canonical = buildCurrentUserResponse({
    access,
    permissions: permissionAccess.permissions,
    permissionRole: permissionAccess.roleKey,
    user: {
      ...user,
      avatar_key: isAvatarKey(user.avatar_key) ? user.avatar_key : null,
    },
    companyLogoUrl,
  });

  return NextResponse.json(canonical, { headers: NO_STORE_HEADERS });
}
