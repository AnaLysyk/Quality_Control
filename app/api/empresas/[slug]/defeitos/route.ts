import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getCompanyDefects } from "@/lib/companyDefects";

function normalizeKanbanStatus(status: "open" | "in_progress" | "done") {
  if (status === "done") return "aprovado";
  if (status === "in_progress") return "em_andamento";
  return "aberto";
}

export async function GET(_req: Request, context: { params: Promise<{ slug?: string }> }) {
  const auth = await authenticateRequest(_req);
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado", defects: [] }, { status: 401 });
  }
  if (!auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return NextResponse.json({ error: "Acesso proibido", defects: [] }, { status: 403 });
  }

  const { slug } = await context.params;
  const companySlug = typeof slug === "string" ? slug.trim() : "";
  if (!companySlug) {
    return NextResponse.json({ error: "slug obrigatório", defects: [] }, { status: 400 });
  }

  if (!auth.isGlobalAdmin) {
    const allowed = Array.isArray(auth.companySlugs) ? auth.companySlugs : auth.companySlug ? [auth.companySlug] : [];
    if (!allowed.includes(companySlug)) {
      return NextResponse.json({ error: "Acesso proibido", defects: [] }, { status: 403 });
    }
  }

  const defectsPayload = await getCompanyDefects(companySlug);
  const defects = defectsPayload.items.map((defect) => ({
    id: defect.id,
    slug: defect.slug,
    title: defect.title,
    origin: defect.origin,
    status: defect.normalizedStatus,
    kanbanStatus: normalizeKanbanStatus(defect.normalizedStatus),
    openedAt: defect.openedAt,
    closedAt: defect.closedAt,
    mttrHours: defect.mttrMs != null ? Math.round((defect.mttrMs / 360000)) / 10 : "",
    run: defect.runSlug || "",
    runSlug: defect.runSlug || "",
    runName: defect.runName || "",
    app: defect.projectCode || "",
    projectCode: defect.projectCode || "",
    severity: defect.severity || "",
    externalUrl: defect.externalUrl || "",
  }));

  return NextResponse.json(
    {
      defects,
      ...(defectsPayload.warning ? { warning: defectsPayload.warning } : {}),
    },
    { status: 200 },
  );
}
