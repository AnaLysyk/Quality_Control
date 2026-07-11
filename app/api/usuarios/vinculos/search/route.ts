import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

const PROFILE_ALIASES: Record<string, string[]> = {
  "lider tc": ["leader_tc"],
  "líder tc": ["leader_tc"],
  lideranca: ["leader_tc"],
  liderança: ["leader_tc"],
  "usuario tc": ["testing_company_user"],
  "usuário tc": ["testing_company_user"],
  "qa tc": ["testing_company_user"],
  "suporte tecnico": ["technical_support", "support"],
  "suporte técnico": ["technical_support", "support"],
  empresa: ["empresa", "company", "company_admin"],
  "usuario empresarial": ["company_user", "user"],
  "usuário empresarial": ["company_user", "user"],
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function roleMatches(query: string) {
  const normalized = normalize(query);
  return Object.entries(PROFILE_ALIASES)
    .filter(([label]) => normalize(label).includes(normalized) || normalized.includes(normalize(label)))
    .flatMap(([, roles]) => roles);
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!checkPermission(user, "relationships:view")) {
    return NextResponse.json({ error: "Sem permissão para visualizar vínculos" }, { status: 403 });
  }

  const db = await getDb();
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "all").trim();
  const global = Boolean(user.isGlobalAdmin);
  const companyIds = new Set<string>();
  if (user.companyId) companyIds.add(user.companyId);

  if (!global) {
    const [memberships, links, assignments] = await Promise.all([
      db.membership.findMany({ where: { userId: user.id }, select: { companyId: true } }),
      db.userCompanyLink.findMany({ where: { userId: user.id, active: true }, select: { companyId: true } }),
      db.projectTeamAssignment.findMany({ where: { userId: user.id, status: "active" }, select: { companyId: true } }),
    ]);
    memberships.forEach((item) => companyIds.add(item.companyId));
    links.forEach((item) => companyIds.add(item.companyId));
    assignments.forEach((item) => companyIds.add(item.companyId));
  }

  const companyScope = global ? undefined : { in: Array.from(companyIds) };
  const matchedRoles = roleMatches(query);
  const enumRoleValues = new Set<string>(Object.values(Role));
  const prismaRoles = matchedRoles.filter((role): role is Role => enumRoleValues.has(role));
  const shouldSearch = query.length >= 2;

  const [companies, projects, people, assignments] = await Promise.all([
    shouldSearch && ["all", "companies"].includes(mode)
      ? db.company.findMany({
          where: {
            active: true,
            ...(companyScope ? { id: companyScope } : {}),
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { company_name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, company_name: true, slug: true, status: true },
          take: 20,
          orderBy: { name: "asc" },
        })
      : [],
    shouldSearch && ["all", "projects"].includes(mode)
      ? db.project.findMany({
          where: {
            archivedAt: null,
            ...(companyScope ? { companyId: companyScope } : {}),
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
              { company: { name: { contains: query, mode: "insensitive" } } },
              { company: { company_name: { contains: query, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            companyId: true,
            name: true,
            slug: true,
            status: true,
            company: { select: { id: true, name: true, company_name: true, slug: true } },
          },
          take: 30,
          orderBy: { name: "asc" },
        })
      : [],
    shouldSearch && ["all", "people", "profiles"].includes(mode)
      ? db.user.findMany({
          where: {
            active: true,
            AND: [
              global
                ? {}
                : {
                    OR: [
                      { home_company_id: companyScope },
                      { memberships: { some: { companyId: companyScope } } },
                      { links: { some: { companyId: companyScope, active: true } } },
                      { projectTeamAssignments: { some: { companyId: companyScope, status: "active" } } },
                    ],
                  },
              mode === "profiles" || matchedRoles.length
                ? {
                    OR: [
                      ...(matchedRoles.length ? [{ globalRole: { in: matchedRoles } }] : []),
                      ...(prismaRoles.length ? [{ role: { in: prismaRoles } }] : []),
                      { globalRole: { contains: query, mode: "insensitive" } },
                    ],
                  }
                : {
                    OR: [
                      { name: { contains: query, mode: "insensitive" } },
                      { full_name: { contains: query, mode: "insensitive" } },
                      { email: { contains: query, mode: "insensitive" } },
                      { user: { contains: query, mode: "insensitive" } },
                      { globalRole: { contains: query, mode: "insensitive" } },
                      { memberships: { some: { company: { name: { contains: query, mode: "insensitive" } } } } },
                      { memberships: { some: { company: { company_name: { contains: query, mode: "insensitive" } } } } },
                    ],
                  },
            ],
          },
          select: {
            id: true,
            name: true,
            full_name: true,
            email: true,
            user: true,
            role: true,
            globalRole: true,
            status: true,
            active: true,
            memberships: {
              select: { companyId: true, role: true, company: { select: { id: true, name: true, company_name: true, slug: true } } },
            },
            projectTeamAssignments: {
              where: { status: "active" },
              select: {
                id: true,
                role: true,
                companyId: true,
                projectId: true,
                company: { select: { id: true, name: true, company_name: true, slug: true } },
                project: { select: { id: true, name: true, slug: true } },
              },
            },
          },
          take: 40,
          orderBy: { name: "asc" },
        })
      : [],
    shouldSearch
      ? db.projectTeamAssignment.findMany({
          where: {
            status: "active",
            ...(companyScope ? { companyId: companyScope } : {}),
            OR: [
              { user: { name: { contains: query, mode: "insensitive" } } },
              { user: { full_name: { contains: query, mode: "insensitive" } } },
              { user: { email: { contains: query, mode: "insensitive" } } },
              { company: { name: { contains: query, mode: "insensitive" } } },
              { company: { company_name: { contains: query, mode: "insensitive" } } },
              { project: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            user: { select: { id: true, name: true, full_name: true, email: true } },
            company: { select: { id: true, name: true, company_name: true, slug: true } },
            project: { select: { id: true, name: true, slug: true } },
          },
          take: 50,
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  const profileCounts = people.reduce<Record<string, number>>((acc, person) => {
    const key = String(person.globalRole ?? person.role ?? "user");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    query,
    mode,
    companies,
    projects,
    people,
    assignments,
    profiles: Object.entries(profileCounts).map(([role, count]) => ({ role, count })),
    permissions: {
      canCreate: checkPermission(user, "relationships:create"),
      canEdit: checkPermission(user, "relationships:edit"),
      canDelete: checkPermission(user, "relationships:delete"),
    },
  });
}
