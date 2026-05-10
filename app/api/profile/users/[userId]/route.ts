import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAccessContext } from "@/lib/auth/session";
import { listLocalUsers, updateLocalUser } from "@/lib/auth/localStore";
import { buildProfileRuntimeContext } from "@/lib/profile/contextBuilder";
import type { ProfileAuditEntry } from "@/lib/profile/types";

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
    const viewer = await getAccessContext();

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
    const context = await buildProfileRuntimeContext({
      viewer,
      targetType: "user",
      targetId: userId,
      targetEntity: targetUser,
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
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      avatar: targetUser.avatar ?? null,
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
    const viewer = await getAccessContext();

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
    const context = await buildProfileRuntimeContext({
      viewer,
      targetType: "user",
      targetId: userId,
      targetEntity: targetUser,
      mode: "view", // Determina modo baseado em lógica se necessário
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
      avatar: targetUser.avatar,
    };

    // Aplicar atualização
    const updated = await updateLocalUser(userId, {
      name: update.name ?? targetUser.name,
      email: update.email ?? targetUser.email,
      phone: update.phone ?? targetUser.phone,
      avatar: update.avatar ?? targetUser.avatar,
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
        avatar: updated.avatar,
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
      email: updated.email,
      avatar: updated.avatar ?? null,
      phone: updated.phone ?? null,
      role: updated.role,
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
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil" },
      { status: 500 },
    );
  }
}
