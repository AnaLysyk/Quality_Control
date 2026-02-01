import { cookies } from "next/headers";

export type Role = "admin" | "company" | "user";

type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};

export async function resolveDefectRole(authUser: AuthUser | null | undefined, clientSlug?: string | null): Promise<Role> {
  // Importa prisma só em ambiente Node/server
  let prisma: typeof import("@/lib/prismaClient").prisma | undefined;
  if (typeof process === "object" && process.env.NEXT_RUNTIME !== "edge") {
    prisma = require("@/lib/prismaClient").prisma;
  }
  if (!authUser) return "user";

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

export const canCreateManualDefect = (role: Role) => role === "admin" || role === "company";
export const canEditManualDefect = (role: Role) => role === "admin" || role === "company";
export const canLinkRun = (role: Role) => role === "admin" || role === "company";
export const canDeleteManualDefect = (role: Role) => role === "admin";

export async function getMockRole(): Promise<Role | null> {
  const store = await cookies();
  const raw = store.get("mock_role")?.value?.toLowerCase();
  if (raw === "admin" || raw === "company" || raw === "user") return raw as Role;
  return null;
}
