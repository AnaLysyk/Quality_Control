import { NextRequest, NextResponse } from "next/server";

import { ClientCreateRequestSchema, ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { syncCompanyApplications } from "@/lib/applicationsStore";
import { deleteLocalCompany, listLocalCompanies, updateLocalCompany } from "@/lib/auth/localStore";
import {
  buildCompanyUpdatePatch,
  mapCompanyRecord,
  normalizeComparableName,
  normalizeTaxId,
} from "@/lib/companyRecord";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Não autenticado" : "Sem permissão", status);

  const { id } = await context.params;
  const companies = await listLocalCompanies();
  const company = companies.find((item) => item.id === id);
  if (!company) return jsonError("Empresa não encontrada", 404);

  return NextResponse.json(ClientSchema.parse(mapCompanyRecord(company)), { status: 200 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Não autenticado" : "Sem permissão", status);

  const { id } = await context.params;
  const companies = await listLocalCompanies();
  const current = companies.find((item) => item.id === id);
  if (!current) return jsonError("Empresa não encontrada", 404);

  const body = await req.json().catch(() => null);
  const parsed = ClientCreateRequestSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError("Payload invalido", 400);

  const input = parsed.data;
  const nextName = (input.company_name ?? input.name ?? current.name ?? current.company_name ?? "").trim();
  if (!nextName) return jsonError("Nome da empresa obrigatório", 400);

  const duplicateByName = companies.find(
    (company) =>
      company.id !== id &&
      normalizeComparableName(company.name ?? company.company_name ?? "") === normalizeComparableName(nextName),
  );
  if (duplicateByName) return jsonError("Empresa já cadastrada com esse nome", 409);

  const nextTaxId = normalizeTaxId(
    typeof input.tax_id === "string" ? input.tax_id : typeof current.tax_id === "string" ? current.tax_id : null,
  );
  const duplicateByTaxId =
    nextTaxId.length > 0
      ? companies.find(
          (company) =>
            company.id !== id &&
            normalizeTaxId(typeof company.tax_id === "string" ? company.tax_id : null) === nextTaxId,
        )
      : null;
  if (duplicateByTaxId) return jsonError("CNPJ já cadastrado para outra empresa", 409);

  const { nextProjectCodes, patch } = buildCompanyUpdatePatch(input, current);
  const updated = await updateLocalCompany(id, patch);

  if (!updated) return jsonError("Empresa não encontrada", 404);

  if (Array.isArray((input as { qase_projects?: unknown[] }).qase_projects) && (input as { qase_projects?: unknown[] }).qase_projects?.length) {
    const projects = ((input as { qase_projects?: unknown[] }).qase_projects ?? [])
      .filter((project): project is Record<string, unknown> => typeof project === "object" && project !== null)
      .map((project) => ({
        code: typeof project.code === "string" ? project.code.trim().toUpperCase() : "",
        title: typeof project.title === "string" ? project.title.trim() : undefined,
        imageUrl: typeof project.imageUrl === "string" ? project.imageUrl.trim() : null,
      }))
      .filter((project) => project.code);

    if (projects.length) {
      await syncCompanyApplications({
        companyId: updated.id,
        companySlug: updated.slug,
        projects,
        source: "qase",
      });
    }
  } else if (nextProjectCodes?.length) {
    await syncCompanyApplications({
      companyId: updated.id,
      companySlug: updated.slug,
      projects: nextProjectCodes.map((code) => ({ code })),
      source: "qase",
    });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.updated",
    entityType: "client",
    entityId: updated.id,
    entityLabel: updated.name ?? updated.company_name ?? updated.slug ?? updated.id,
    metadata: {
      active: updated.active ?? true,
      integrationMode: updated.integration_mode ?? "manual",
      _before: {
        active: current.active ?? null,
        integrationMode: current.integration_mode ?? null,
        name: current.name ?? current.company_name ?? null,
      },
      _payload: input,
    },
  });

  return NextResponse.json(ClientSchema.parse(mapCompanyRecord(updated)), { status: 200 });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Não autenticado" : "Sem permissão", status);

  const { id } = await context.params;
  const companies = await listLocalCompanies();
  const current = companies.find((item) => item.id === id);
  if (!current) return jsonError("Empresa não encontrada", 404);

  const deleted = await deleteLocalCompany(id);
  if (!deleted) return jsonError("Empresa não encontrada", 404);

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.deleted",
    entityType: "client",
    entityId: current.id,
    entityLabel: current.name ?? current.company_name ?? current.slug ?? current.id,
    metadata: {
      slug: current.slug ?? null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
