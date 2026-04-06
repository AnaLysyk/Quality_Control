import type { AccessContext } from "@/lib/auth/session";
import {
  findLocalCompanyById,
  listLocalCompanies,
  type LocalAuthCompany,
} from "@/lib/auth/localStore";

export function canManageInstitutionalCompanyAccess(access: AccessContext | null | undefined) {
  if (!access) return false;
  return (
    access.companyRole === "company_admin" ||
    access.role === "company" ||
    Boolean(access.companyId || access.companySlug)
  );
}

export async function resolveCurrentCompanyFromAccess(access: AccessContext | null | undefined): Promise<{
  company: LocalAuthCompany | null;
  status: 200 | 401 | 403 | 404;
}> {
  if (!access) {
    return { company: null, status: 401 };
  }

  if (!access.companyId && !access.companySlug) {
    return { company: null, status: 403 };
  }

  const company =
    (access.companyId ? await findLocalCompanyById(access.companyId) : null) ??
    (access.companySlug
      ? (await listLocalCompanies()).find((item) => item.slug === access.companySlug) ?? null
      : null);

  if (!company) {
    return { company: null, status: 404 };
  }

  return { company, status: 200 };
}
