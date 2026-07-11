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
      modules: ["Solicitacoes", "Suporte", "Defeitos", "Casos de Teste", "Planos de Teste", "Execucoes", "Automacao", "Documentos", "Usuarios", "Logs", "Historico"],
      permissions: {
        canViewGlobalBrain: false,
        canViewLogs: false,
        canViewAudit: false,
        canExecuteActions: false,
        canChangeCompany: false,
        canChangeProject: false,
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
  const baseModules = ["Solicitacoes", "Suporte", "Defeitos", "Controle de Qualidade", "Casos de Teste", "Testes Manuais", "Planos de Teste", "Execucoes", "Fila de Execucao", "Automacao", "Fluxos de Automacao", "Documentos", "Usuarios", "Permissoes", "Logs", "Historico"];
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
  const allowedProjectIds = Array.from(context.allowedProjectIds);
  const projects = scopedCompanyIds.length
    ? await prisma.project.findMany({
        where: {
          companyId: { in: scopedCompanyIds },
          archivedAt: null,
          ...(context.hasGlobalVisibility ? {} : { id: { in: allowedProjectIds } }),
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
      canChangeCompany: companies.length > 1,
      canChangeProject: projects.length > 1,
    },
    defaultContext: {
      companyId: defaultCompanyId,
      projectId: defaultProjectId,
      module: null,
    },
    source: "database",
  });
}

