import { cookies } from "next/headers";

import { SUPABASE_MOCK } from "@/lib/supabaseMock";

export type Role = "admin" | "company" | "user";

type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};

export async function getMockRole(): Promise<Role | null> {
  if (!SUPABASE_MOCK) return null;
  const cookieStore = await cookies();
  const mockRole = cookieStore.get("mock_role")?.value?.toLowerCase();
  if (mockRole === "admin" || mockRole === "company" || mockRole === "user") {
    return mockRole;
  }
  return null;
}

export async function resolveDefectRole(authUser: AuthUser | null | undefined, clientSlug?: string | null): Promise<Role> {
  // Importa prisma só em ambiente Node/server
  let prisma: typeof import("@/lib/prisma").prisma | undefined;
  if (typeof process === "object" && process.env.NEXT_RUNTIME !== "edge") {
    prisma = require("@/lib/prisma").prisma;
  }
  if (!authUser) return "user";

  const mockRole = await getMockRole();
  if (mockRole) return mockRole;

  if (authUser.isGlobalAdmin) return "admin";

  let links: any[] = [];
  if (prisma) {
    links = await prisma.userCompany.findMany({
      where: { user_id: authUser.id },
      include: { company: true },
    });
  }
  type Link = { role?: string | null; company?: { slug?: string | null } | null };

  if (!links.length) return "user";

  const hasAdminLink = links.some((link: Link) => (link.role ?? "").toLowerCase() === "admin");
  if (clientSlug) {
    const hasClient = links.some((link: Link) => link.company?.slug === clientSlug);
    if (!hasClient) return "user";
  }

  if (hasAdminLink) return "admin";
  if (links.length === 1) return "company";
  return "user";
}
}

export const canCreateManualDefect = (role: Role) =>
  role === "admin" || role === "company" || (SUPABASE_MOCK && role === "user");
export const canEditManualDefect = (role: Role) => role === "admin" || role === "company";
export const canLinkRun = (role: Role) => role === "admin" || role === "company";
export const canDeleteManualDefect = (role: Role) => role === "admin";
