import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getRequestById, updateRequestStatus, type RequestStatus } from "@/data/requestsStore";
import { getLocalUserById, updateLocalUser } from "@/lib/auth/localStore";
import { emailService } from "@/lib/email";
import { authenticateRequest } from "@/lib/jwtAuth";
import { notifyPasswordResetStatus, notifyProfileDeletionStatus } from "@/lib/notificationService";
import { storePasswordResetToken } from "@/lib/auth/passwordResetToken";
import { canAccessSelfServiceRequest, canReviewSelfServiceRequests } from "@/lib/selfServiceRequestAccess";

function isFinalStatus(value: string | null): value is Exclude<RequestStatus, "PENDING" | "NEEDS_REVISION"> {
  return value === "APPROVED" || value === "REJECTED";
}

function isValidNextStatus(value: string | null): value is Exclude<RequestStatus, "PENDING"> {
  return value === "APPROVED" || value === "REJECTED" || value === "NEEDS_REVISION";
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ message: "NÃ£o autenticado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string; reviewNote?: string } | null;
  const rawStatus = body?.status ?? null;
  const nextStatus: Exclude<RequestStatus, "PENDING"> | null = isValidNextStatus(rawStatus) ? rawStatus : null;
  if (!nextStatus) {
    return NextResponse.json({ message: "Status invalido" }, { status: 400 });
  }

  const { id } = await context.params;
  const requestRecord = await getRequestById(id);
  if (!requestRecord) {
    return NextResponse.json({ message: "SolicitaÃ§Ã£o nÃ£o encontrada" }, { status: 404 });
  }
  if (!canAccessSelfServiceRequest(authUser, requestRecord)) {
    return NextResponse.json({ message: "Sem permissÃ£o para esta solicitaÃ§Ã£o" }, { status: 403 });
  }
  if (!canReviewSelfServiceRequests(authUser)) {
    return NextResponse.json({ message: "Sem permissÃ£o para revisar solicitaÃ§Ãµes" }, { status: 403 });
  }

  const reviewNote = (body?.reviewNote ?? "").trim();
  if (nextStatus === "REJECTED" && reviewNote.length === 0) {
    return NextResponse.json({ message: "ComentÃ¡rio Ã© obrigatÃ³rio para rejeitar" }, { status: 400 });
  }

  if (nextStatus === "APPROVED" && requestRecord.userId === authUser.id) {
    return NextResponse.json({ message: "AutoaprovaÃ§Ã£o nÃ£o Ã© permitida" }, { status: 403 });
  }

  if (requestRecord.status !== "PENDING" && requestRecord.status !== "NEEDS_REVISION") {
    return NextResponse.json({ item: requestRecord });
  }

  if (nextStatus === "APPROVED" && requestRecord.type === "PASSWORD_RESET") {
    const user = await getLocalUserById(requestRecord.userId);
    if (!user) {
      return NextResponse.json({ message: "UsuÃ¡rio nÃ£o encontrado" }, { status: 404 });
    }
    const token = randomUUID();
    await storePasswordResetToken(token, user.id);
    const targetEmail = user.email || requestRecord.userEmail;
    if (!targetEmail) {
      return NextResponse.json({ message: "Email do usuÃ¡rio nÃ£o encontrado" }, { status: 400 });
    }
    const emailSent = await emailService.sendPasswordResetEmail(targetEmail, token);
    if (!emailSent) {
      return NextResponse.json({ message: "Falha ao enviar email de reset" }, { status: 500 });
    }
  }

  if (nextStatus === "APPROVED" && requestRecord.type === "PROFILE_DELETION") {
    const user = await getLocalUserById(requestRecord.userId);
    if (!user) {
      return NextResponse.json({ message: "UsuÃ¡rio nÃ£o encontrado" }, { status: 404 });
    }
    const updatedUser = await updateLocalUser(user.id, {
      active: false,
      status: "blocked",
    });
    if (!updatedUser) {
      return NextResponse.json({ message: "NÃ£o foi possÃ­vel desativar o perfil" }, { status: 500 });
    }
  }

  const updated = await updateRequestStatus(id, nextStatus, { id: authUser.id }, reviewNote || undefined);
  if (updated && isFinalStatus(nextStatus)) {
    if (updated.type === "PASSWORD_RESET") {
      try {
        await notifyPasswordResetStatus(updated, nextStatus);
      } catch (err) {
        console.error("Falha ao notificar status de reset", err);
      }
    }
    if (updated.type === "PROFILE_DELETION") {
      try {
        await notifyProfileDeletionStatus(updated, nextStatus);
      } catch (err) {
        console.error("Falha ao notificar status de exclusÃ£o de perfil", err);
      }
    }
  }

  return NextResponse.json({ item: updated });
}

