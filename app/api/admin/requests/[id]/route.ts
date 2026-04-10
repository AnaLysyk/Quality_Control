import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getRequestById, updateRequestStatus, type RequestStatus } from "@/data/requestsStore";
import { getLocalUserById, updateLocalUser } from "@/lib/auth/localStore";
import { emailService } from "@/lib/email";
import { authenticateRequest } from "@/lib/jwtAuth";
import { notifyPasswordResetStatus, notifyProfileDeletionStatus } from "@/lib/notificationService";
import { getRedis } from "@/lib/redis";
import { canAccessSelfServiceRequest, canReviewSelfServiceRequests } from "@/lib/selfServiceRequestAccess";

function isFinalStatus(value: string | null): value is Exclude<RequestStatus, "PENDING"> {
  return value === "APPROVED" || value === "REJECTED";
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string; reviewNote?: string } | null;
  const rawStatus = body?.status ?? null;
  const nextStatus: Exclude<RequestStatus, "PENDING"> | null = isFinalStatus(rawStatus) ? rawStatus : null;
  if (!nextStatus) {
    return NextResponse.json({ message: "Status invalido" }, { status: 400 });
  }

  const { id } = await context.params;
  const requestRecord = await getRequestById(id);
  if (!requestRecord) {
    return NextResponse.json({ message: "Solicitacao nao encontrada" }, { status: 404 });
  }
  if (!canAccessSelfServiceRequest(authUser, requestRecord)) {
    return NextResponse.json({ message: "Sem permissao para esta solicitacao" }, { status: 403 });
  }
  if (!canReviewSelfServiceRequests(authUser)) {
    return NextResponse.json({ message: "Sem permissao para revisar solicitacoes" }, { status: 403 });
  }
  if (requestRecord.status !== "PENDING") {
    return NextResponse.json({ item: requestRecord });
  }

  if (nextStatus === "APPROVED" && requestRecord.type === "PASSWORD_RESET") {
    const user = await getLocalUserById(requestRecord.userId);
    if (!user) {
      return NextResponse.json({ message: "Usuario nao encontrado" }, { status: 404 });
    }
    const token = randomUUID();
    const redis = getRedis();
    await redis.set(`reset:${token}`, user.id, { ex: 15 * 60 });
    const targetEmail = user.email || requestRecord.userEmail;
    if (!targetEmail) {
      return NextResponse.json({ message: "Email do usuario nao encontrado" }, { status: 400 });
    }
    const emailSent = await emailService.sendPasswordResetEmail(targetEmail, token);
    if (!emailSent) {
      return NextResponse.json({ message: "Falha ao enviar email de reset" }, { status: 500 });
    }
  }

  if (nextStatus === "APPROVED" && requestRecord.type === "PROFILE_DELETION") {
    const user = await getLocalUserById(requestRecord.userId);
    if (!user) {
      return NextResponse.json({ message: "Usuario nao encontrado" }, { status: 404 });
    }
    const updatedUser = await updateLocalUser(user.id, {
      active: false,
      status: "blocked",
    });
    if (!updatedUser) {
      return NextResponse.json({ message: "Nao foi possivel desativar o perfil" }, { status: 500 });
    }
  }

  const updated = await updateRequestStatus(id, nextStatus, { id: authUser.id }, body?.reviewNote);
  if (updated && updated.type === "PASSWORD_RESET") {
    try {
      await notifyPasswordResetStatus(updated, nextStatus);
    } catch (err) {
      console.error("Falha ao notificar status de reset", err);
    }
  }
  if (updated && updated.type === "PROFILE_DELETION") {
    try {
      await notifyProfileDeletionStatus(updated, nextStatus);
    } catch (err) {
      console.error("Falha ao notificar status de exclusao de perfil", err);
    }
  }

  return NextResponse.json({ item: updated });
}
