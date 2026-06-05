import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { listLocalUsers, updateLocalUser } from "@/lib/auth/localStore";
import { buildProfileRuntimeContext } from "@/lib/profile/contextBuilder";
import type { EntityStatus, ProfileAuditEntry, UserRole } from "@/lib/profile/types";

function normalizeProfileStatus(status: unknown): EntityStatus | undefined {
  if (
    status === "active" ||
    status === "blocked" ||
    status === "inactive" ||
    status === "archived" ||
    status === "suspended" ||
    status === "pending"
  ) {
    return status;
  }
  if (status === "invited") return "pending";
  return undefined;
}

/**
 * GET /api/profile/users/[userId]
 * Retorna perfil do usuário
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const viewer = await authenticateRequest(req);

    if (!viewer) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 },
      );
    }

    const users = await listLocalUsers();
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 },
      );
    }

    // Construir contexto (valida permissões)
    const context = buildProfileRuntimeContext({
      viewer,
      entityType: "user",
      entityId: userId,
      mode: "view",
      targetRole: (targetUser.role ?? "company_user") as UserRole,
      targetStatus: normalizeProfileStatus(targetUser.status),
      isSelf: viewer.id === userId,
      isSameCompany:
        Boolean(viewer.companyId && viewer.companyId === targetUser.home_company_id) ||
        (viewer.companySlugs ?? []).some((slug) => slug === targetUser.default_company_slug),
    });

    if (!context.permissions.canView) {
      return NextResponse.json(
        { error: "Sem permissão para visualizar" },
        { status: 403 },
      );
    }

    // Retornar apenas campos visíveis
    return NextResponse.json({
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      avatar: targetUser.avatar_url ?? null,
      phone: targetUser.phone ?? null,
      role: targetUser.role,
      status: targetUser.status,
      context, // Debug: incluir contexto para validação
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/profile/users/[userId]
 * Atualiza perfil do usuário
 */
const UpdateUserProfileSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const viewer = await authenticateRequest(req);

    if (!viewer) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 },
      );
    }

    const users = await listLocalUsers();
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 },
      );
    }

    // Construir contexto (valida permissões)
    const context = buildProfileRuntimeContext({
      viewer,
      entityType: "user",
      entityId: userId,
      mode: "edit",
      targetRole: (targetUser.role ?? "company_user") as UserRole,
      targetStatus: normalizeProfileStatus(targetUser.status),
      isSelf: viewer.id === userId,
      isSameCompany:
        Boolean(viewer.companyId && viewer.companyId === targetUser.home_company_id) ||
        (viewer.companySlugs ?? []).some((slug) => slug === targetUser.default_company_slug),
    });

    if (!context.permissions.canEdit) {
      return NextResponse.json(
        { error: "Sem permissão para editar" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const update = UpdateUserProfileSchema.parse(body);

    // Criar antes/depois para auditoria
    const before = {
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone,
      avatar: targetUser.avatar_url,
    };

    // Aplicar atualização
    const updated = await updateLocalUser(userId, {
      name: update.name ?? targetUser.name,
      email: update.email ?? targetUser.email,
      phone: update.phone ?? targetUser.phone,
      avatar_url: update.avatar ?? targetUser.avatar_url,
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
      entityType: "user",
      entityId: userId,
      action: "update_profile",
      field: "profile",
      before,
      after: {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        avatar: updated.avatar_url,
      },
      actor: {
        id: viewer.id,
        name: viewer.user ?? viewer.email,
        role: (viewer.role ?? "company_user") as ProfileAuditEntry["actor"]["role"],
      },
      reason: update.reason,
      origin: "web",
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      createdAt: new Date().toISOString(),
    };

    // TODO: salvar auditEntry em store

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatar: updated.avatar_url ?? null,
      phone: updated.phone ?? null,
      role: updated.role,
      status: updated.status,
      audit: auditEntry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validação falhou", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil" },
      { status: 500 },
    );
  }
}
