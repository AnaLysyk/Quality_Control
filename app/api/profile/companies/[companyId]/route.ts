import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAccessContext } from "@/lib/auth/session";
import { findLocalCompanyById, updateLocalCompany } from "@/lib/auth/localStore";
import { buildProfileRuntimeContext } from "@/lib/profile/contextBuilder";
import type { ProfileAuditEntry } from "@/lib/profile/types";

/**
 * GET /api/profile/companies/[companyId]
 * Retorna perfil da empresa
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const { companyId } = await params;
    const viewer = await getAccessContext();

    if (!viewer) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 },
      );
    }

    const company = await findLocalCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 404 },
      );
    }

    // Construir contexto (valida permissões)
    const context = await buildProfileRuntimeContext({
      viewer,
      targetType: "company",
      targetId: companyId,
      targetEntity: company,
      mode: "view",
    });

    if (!context.permissions.canView) {
      return NextResponse.json(
        { error: "Sem permissão para visualizar" },
        { status: 403 },
      );
    }

    // Retornar apenas campos visíveis
    return NextResponse.json({
      id: company.id,
      name: company.name,
      slug: company.slug,
      taxId: company.tax_id ?? null,
      address: company.address ?? null,
      city: company.city ?? null,
      state: company.state ?? null,
      country: company.country ?? null,
      phone: company.phone ?? null,
      website: company.website ?? null,
      status: company.status,
      context, // Debug: incluir contexto para validação
    });
  } catch (error) {
    console.error("Error fetching company profile:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/profile/companies/[companyId]
 * Atualiza perfil da empresa
 */
const UpdateCompanyProfileSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  taxId: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const { companyId } = await params;
    const viewer = await getAccessContext();

    if (!viewer) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 },
      );
    }

    const company = await findLocalCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 404 },
      );
    }

    // Construir contexto (valida permissões)
    const context = await buildProfileRuntimeContext({
      viewer,
      targetType: "company",
      targetId: companyId,
      targetEntity: company,
      mode: "view",
    });

    if (!context.permissions.canEdit) {
      return NextResponse.json(
        { error: "Sem permissão para editar" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const update = UpdateCompanyProfileSchema.parse(body);

    // Criar antes/depois para auditoria
    const before = {
      name: company.name,
      taxId: company.tax_id,
      phone: company.phone,
      website: company.website,
      address: company.address,
    };

    // Aplicar atualização
    const updated = await updateLocalCompany(companyId, {
      name: update.name ?? company.name,
      tax_id: update.taxId ?? company.tax_id,
      phone: update.phone ?? company.phone,
      website: update.website ?? company.website,
      address: update.address ?? company.address,
      city: update.city ?? company.city,
      state: update.state ?? company.state,
      country: update.country ?? company.country,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Erro ao atualizar perfil" },
        { status: 500 },
      );
    }

    // Log de auditoria (simplificado; em produção seria em Prisma)
    const auditEntry: ProfileAuditEntry = {
      id: crypto.randomUUID(),
      entityType: "company",
      entityId: companyId,
      action: "update_profile",
      field: "profile",
      before,
      after: {
        name: updated.name,
        taxId: updated.tax_id,
        phone: updated.phone,
        website: updated.website,
        address: updated.address,
      },
      actor: viewer.id,
      actorRole: viewer.role,
      timestamp: new Date(),
      reason: update.reason,
      origin: "web",
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    };

    // TODO: salvar auditEntry em store

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      taxId: updated.tax_id ?? null,
      address: updated.address ?? null,
      city: updated.city ?? null,
      state: updated.state ?? null,
      country: updated.country ?? null,
      phone: updated.phone ?? null,
      website: updated.website ?? null,
      status: updated.status,
      audit: auditEntry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validação falhou", details: error.errors },
        { status: 400 },
      );
    }
    console.error("Error updating company profile:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil" },
      { status: 500 },
    );
  }
}
