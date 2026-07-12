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
  assignments.forEach((item) => ids.add(item.companyId));
  return Array.from(ids);
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!checkPermission(user, "relationships:view")) {
    return NextResponse.json({ error: "Sem permissão para visualizar histórico de vínculos" }, { status: 403 });
  }

  const db = await getDb();
  const companyIds = await resolveScopedCompanyIds(user);
  const url = new URL(req.url);
  const requestedCompanyId = url.searchParams.get("companyId")?.trim();

  if (requestedCompanyId && companyIds && !companyIds.includes(requestedCompanyId)) {
    return NextResponse.json({ error: "Empresa fora do seu contexto autorizado" }, { status: 403 });
  }

  const assignments = await db.projectTeamAssignment.findMany({
    where: {
      status: "removed",
      ...(requestedCompanyId
        ? { companyId: requestedCompanyId }
        : companyIds
          ? { companyId: { in: companyIds } }
          : {}),
    },
    orderBy: [{ removedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      role: true,
      status: true,
      createdAt: true,
      removedAt: true,
      removalReason: true,
      company: {
        select: { id: true, name: true, company_name: true, slug: true },
      },
      project: {
        select: { id: true, name: true, slug: true },
      },
      user: {
        select: {
          id: true,
          name: true,
          full_name: true,
          email: true,
          avatar_url: true,
          avatar_key: true,
        },
      },
    },
  });

  const companies = new Map<string, {
    id: string;
    name: string;
    slug: string;
    entries: typeof assignments;
  }>();

  for (const assignment of assignments) {
    const current = companies.get(assignment.company.id) ?? {
      id: assignment.company.id,
      name: assignment.company.company_name || assignment.company.name,
      slug: assignment.company.slug,
      entries: [],
    };
    current.entries.push(assignment);
    companies.set(assignment.company.id, current);
  }

  return NextResponse.json({
    companies: Array.from(companies.values()),
    total: assignments.length,
  });
}
