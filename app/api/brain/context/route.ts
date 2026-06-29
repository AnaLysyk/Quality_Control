import { NextResponse } from "next/server";
import { resolveBrainAccess } from "@/lib/brain/access";

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
  const canViewLogs = context.hasGlobalVisibility || context.canManage;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.user ?? user.email,
      role: user.role,
      companyRole: user.companyRole,
    },
    companies: Array.from(context.allowedCompanyIds).map((id) => ({ id, name: "Empresa permitida" })),
    projects: [{ id: "project_qc", name: "Quality Control", companyId: Array.from(context.allowedCompanyIds)[0] ?? null }],
    modules: ["Solicitacoes", "Defeitos", "Automacao", "Documentos", "Usuarios", "Permissoes", ...(canViewLogs ? ["Logs"] : [])],
    permissions: {
      canViewGlobalBrain: context.hasGlobalVisibility,
      canViewLogs,
      canViewAudit: canViewLogs,
      canExecuteActions: context.canManage,
    },
    defaultContext: {
      companyId: Array.from(context.allowedCompanyIds)[0] ?? null,
      projectId: "project_qc",
      module: null,
    },
    source: "database",
  });
}
