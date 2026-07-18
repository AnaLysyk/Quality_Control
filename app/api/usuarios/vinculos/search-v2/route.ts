import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelationshipMode = "companies" | "leaders" | "qa_users" | "business_users";

const ALL_MODES: RelationshipMode[] = ["companies", "leaders", "qa_users", "business_users"];
const COMPANY_MODES: RelationshipMode[] = ["qa_users", "business_users"];

async function getDb() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

function normalizeRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveOperatorRole(user: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>) {
  return normalizeRole(user.permissionRole ?? user.role ?? user.companyRole ?? user.globalRole);
}

function isCompanyOperator(role: string) {
  return ["empresa", "company", "company_admin"].includes(role);
}

function hasPlatformVisibility(user: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>, role: string) {
  return Boolean(user.isGlobalAdmin || ["technical_support", "support"].includes(role));
}

function modeLabel(mode: RelationshipMode) {
  if (mode === "companies") return "Empresas";
  if (mode === "leaders") return "Líder TC";
  if (mode === "qa_users") return "Usuário TC";
  return "Usuário empresarial";
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
  const requestedMode = (url.searchParams.get("mode") ?? "qa_users") as RelationshipMode;
  const operatorRole = resolveOperatorRole(user);
  const companyOperator = isCompanyOperator(operatorRole);
  const platformVisibility = hasPlatformVisibility(user, operatorRole);
  const allowedModes = companyOperator ? COMPANY_MODES : ALL_MODES;
  const mode = allowedModes.includes(requestedMode) ? requestedMode : allowedModes[0];

  const companyIds = new Set<string>();
  if (user.companyId) companyIds.add(user.companyId);

  if (!platformVisibility) {
    const [memberships, links, assignments] = await Promise.all([
      db.membership.findMany({ where: { userId: user.id }, select: { companyId: true } }),
      db.userCompanyLink.findMany({ where: { userId: user.id, active: true }, select: { companyId: true } }),
      db.projectTeamAssignment.findMany({ where: { userId: user.id, status: "active" }, select: { companyId: true } }),
    ]);
    memberships.forEach((item) => companyIds.add(item.companyId));
    links.forEach((item) => companyIds.add(item.companyId));
    assignments.forEach((item) => companyIds.add(item.companyId));
  }

  const scopedIds = Array.from(companyIds);
  const companyScope = platformVisibility ? undefined : { in: scopedIds };
  const hasQuery = query.length >= 3;
  const invalidShortQuery = query.length > 0 && query.length < 3;

  const permissions = {
    canCreate: checkPermission(user, "relationships:create"),
    canEdit: checkPermission(user, "relationships:edit"),
    canDelete: checkPermission(user, "relationships:delete"),
  };

  if (invalidShortQuery) {
    return NextResponse.json({
      query,
      mode,
      modeLabel: modeLabel(mode),
      allowedModes,
      operatorRole,
      companyOperator,
      companies: [],
      people: [],
      assignments: [],
      permissions,
    });
  }

  const textFilters: Prisma.UserWhereInput[] = hasQuery
    ? [
        { name: { contains: query, mode: "insensitive" } },
        { full_name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { user: { contains: query, mode: "insensitive" } },
        { memberships: { some: { company: { name: { contains: query, mode: "insensitive" } } } } },
        { memberships: { some: { company: { company_name: { contains: query, mode: "insensitive" } } } } },
        { projectTeamAssignments: { some: { project: { name: { contains: query, mode: "insensitive" } }, status: "active" } } },
      ]
    : [];

  const roleFilter: Prisma.UserWhereInput = (() => {
    if (mode === "leaders") {
      return {
        OR: [
          { role: Role.leader_tc },
          { globalRole: "leader_tc" },
          { memberships: { some: { role: Role.leader_tc } } },
          { projectTeamAssignments: { some: { role: "leader_tc", status: "active" } } },
        ],
      };
    }
    if (mode === "qa_users") {
      return {
        OR: [
          { globalRole: { in: ["testing_company_user", "qa_tc"] } },
          { projectTeamAssignments: { some: { role: "qa_tc", status: "active" } } },
          {
            AND: [
              { user_origin: "testing_company" },
              { user_scope: "shared" },
              { role: Role.user },
              { is_global_admin: false },
            ],
          },
        ],
      };
    }
    return {
      AND: [
        {
          OR: [
            { globalRole: { in: ["company_user", "business_user"] } },
            { user_origin: "client_company" },
            { user_scope: "company_only" },
            { allow_multi_company_link: false },
          ],
        },
        {
          OR: [
            { home_company_id: { not: null } },
            { created_by_company_id: { not: null } },
            { memberships: { some: {} } },
            { links: { some: { active: true } } },
          ],
        },
      ],
    };
  })();

  const scopeFilter: Prisma.UserWhereInput = platformVisibility
    ? {}
    : {
        OR: [
          { home_company_id: companyScope },
          { created_by_company_id: companyScope },
          { memberships: { some: { companyId: companyScope } } },
          { links: { some: { companyId: companyScope, active: true } } },
          { projectTeamAssignments: { some: { companyId: companyScope, status: "active" } } },
        ],
      };

  const [companies, people] = await Promise.all([
    mode === "companies"
      ? db.company.findMany({
          where: {
            active: true,
            ...(companyScope ? { id: companyScope } : {}),
            ...(hasQuery
              ? {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { company_name: { contains: query, mode: "insensitive" } },
                    { slug: { contains: query, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          select: { id: true, name: true, company_name: true, slug: true, status: true, logo_url: true },
          orderBy: { name: "asc" },
          take: 50,
        })
      : [],
    mode !== "companies"
      ? db.user.findMany({
          where: {
            active: true,
            AND: [scopeFilter, roleFilter, ...(hasQuery ? [{ OR: textFilters }] : [])],
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
            avatar_url: true,
            avatar_key: true,
            home_company_id: true,
            created_by_company_id: true,
            memberships: {
              select: {
                companyId: true,
                role: true,
                allowedProjectIds: true,
                company: { select: { id: true, name: true, company_name: true, slug: true } },
              },
            },
            links: {
              where: { active: true },
              select: {
                companyId: true,
                company: { select: { id: true, name: true, company_name: true, slug: true } },
              },
            },
            projectTeamAssignments: {
              where: { status: "active" },
              select: {
                id: true,
                role: true,
                status: true,
                companyId: true,
                projectId: true,
                company: { select: { id: true, name: true, company_name: true, slug: true } },
                project: { select: { id: true, name: true, slug: true } },
              },
            },
          },
          orderBy: { name: "asc" },
          take: 80,
        })
      : [],
  ]);

  const personIds = people.map((person) => person.id);
  const companyResultIds = companies.map((company) => company.id);
  const assignmentWhere: Prisma.ProjectTeamAssignmentWhereInput | null = mode === "companies"
    ? companyResultIds.length
      ? { companyId: { in: companyResultIds }, status: "active" }
      : null
    : personIds.length
      ? {
          userId: { in: personIds },
          status: "active",
          ...(companyScope ? { companyId: companyScope } : {}),
        }
      : null;

  const assignments = assignmentWhere
    ? await db.projectTeamAssignment.findMany({
        where: assignmentWhere,
        select: {
          id: true,
          role: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, name: true, full_name: true, email: true, avatar_url: true, avatar_key: true } },
          company: { select: { id: true, name: true, company_name: true, slug: true } },
          project: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ companyId: "asc" }, { projectId: "asc" }, { role: "asc" }],
        take: 300,
      })
    : [];

  return NextResponse.json({
    query,
    mode,
    modeLabel: modeLabel(mode),
    allowedModes,
    operatorRole,
    companyOperator,
    companies,
    people,
    assignments,
    permissions,
  });
}
