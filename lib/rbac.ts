import { getAccessContext } from "@/lib/auth/session";

export type AuthContext = { userId: string; companySlugs: string[] };

export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const access = await getAccessContext(req);
  if (!access) return null;
  return {
    userId: access.userId,
    companySlugs: access.companySlugs,
  };
}

export function canAccessCompany(auth: AuthContext, companySlug: string) {
  return auth.companySlugs.includes(companySlug);
}
