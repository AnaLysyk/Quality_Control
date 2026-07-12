import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>;

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

function normalizedRole(user: AuthUser) {
  return String(user.permissionRole ?? user.role ?? user.companyRole ?? user.globalRole ?? "")
    .trim()
    .toLowerCase();
}

function hasGlobalVisibility(user: AuthUser) {
  return Boolean(
    user.isGlobalAdmin ||
      ["global_admin", "technical_support", "support"].includes(normalizedRole(user)),
  );
}

async function resolveScopedCompanyIds(user: AuthUser) {
  if (hasGlobalVisibility(user)) return null;

  const db = await getDb();
  const ids = new Set<string>();
  if (user.companyId) ids.add(user.companyId);

  const [memberships, links, assignments] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id }, select: { companyId: true } }),
    db.userCompanyLink.findMany({ where: { userId: user.id, active: true }, select: { companyId: true } }),
    db.projectTeamAssignment.findMany({
      where: { userId: user.id, status: "active" },
      select: { companyId: true },
    }),
  ]);

  memberships.forEach((item) => ids.add(item.companyId));
  links.forEach((item) => ids.add(item.companyId));
  assignments.forEach((item) =>