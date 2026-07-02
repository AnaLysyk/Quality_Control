import { NextResponse } from "next/server";
import { canAccessBrainModule, resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);

  if (!accessResult.ok) {
    return NextResponse.json({
      user: null,
      companies: [],
      projects: [],
      modules: ["Solicitacoes", "Defeitos", "Automacao", "Documentos", "Usuarios", "Permissoes"],
      permissions: {
        canViewGlobalBrain: false,
        canViewLogs: false,
        canViewAudit: false,
        canExecuteActions: false,
      },
      defaultContext: {
        companyId: null,
        projectId: null,
        module: null,
      },
      source: "fallback",
      warning: accessResult.error,
    });
  }

  const { context } = accessResult;
  const user = context.user;
  const baseModules = ["Solicitacoes", "Defeitos", "Automacao", "Documentos", "Usuarios", "Permissoes", "Logs"];
  const modules = baseModules.filter((moduleName) => canAccessBrainModule(context, moduleName));
  const canViewLogs = modules.includes("Logs");
  const allowedCompanyIds = Array.from(context.allowedCompanyIds);
  const companies = await prisma.company.findMany({
    where: context.hasGlobalVisibility
      ? { active: true }
      : {
          id: { in: allowedCompanyIds },
          active: true,
        },
    select: { id: true, name: true, company_name: true, slug: true },
    orderBy: { name: "asc" },
  });
  const scopedCompanyIds = companies.map((company) => company.id);
  const projects = scopedCompanyIds.length
    ? await prisma.project.findMany({
        where: {
          companyId: { in: scopedCompanyIds },
          archivedAt: null,
        },
        select: { id: true, name: true, companyId: true },
        orderBy: { name: "asc" },
      })
    : [];
  const defaultCompanyId = user.companyId && scopedCompanyIds.includes(user.companyId) ? user.companyId : scopedCompanyIds[0] ?? null;
  const defaultProjectId = projects.find((project) => project.companyId === defaultCompanyId)?.id ?? projects[0]?.id ?? null;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.user ?? user.email,
      role: user.role,
      companyRole: user.companyRole,
    },
    companies: companies.map((company) => ({
      id: company.id,
      name: company.company_name || company.name,
      slug: company.slug,
    })),
    projects,
    modules,
    permissions: {
      canViewGlobalBrain: context.hasGlobalVisibility,
      canViewLogs,
      canViewAudit: canViewLogs,
      canExecuteActions: context.canManage,
    },
    defaultContext: {
      companyId: defaultCompanyId,
      projectId: defaultProjectId,
      module: null,
    },
    source: "database",
  });
}

