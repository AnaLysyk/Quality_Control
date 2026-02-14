import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { authenticateRequest } from "@/lib/jwtAuth";
import { getRequestById, updateRequestStatus, type RequestStatus } from "@/data/requestsStore";
import { getRedis } from "@/lib/redis";
import { emailService } from "@/lib/email";
import { getLocalUserById } from "@/lib/auth/localStore";
import { notifyPasswordResetStatus } from "@/lib/notificationService";

function isFinalStatus(value: string | null): value is Exclude<RequestStatus, "PENDING"> {
  return value === "APPROVED" || value === "REJECTED";
}

type RouteContext = { params: { id: string } };

function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return json({ message: "Nao autenticado" }, { status: 401 });
  }
  if (!authUser.isGlobalAdmin) {
    return json({ message: "Sem permissao" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rawStatus =
    typeof body?.status === "string" ? body.status.toUpperCase() : null;
  const nextStatus: Exclude<RequestStatus, "PENDING"> | null = isFinalStatus(rawStatus) ? rawStatus : null;
  if (!nextStatus) {
    return json({ message: "Status invalido" }, { status: 400 });
  }

  const id = `${params.id ?? ""}`.trim();
  if (!id) {
    return json({ message: "ID ausente" }, { status: 400 });
  }

  const reviewNoteValue = typeof body?.reviewNote === "string" ? body.reviewNote.trim() : "";
  const reviewNote = reviewNoteValue.length > 0 ? reviewNoteValue : undefined;

  const requestRecord = await getRequestById(id);
  if (!requestRecord) {
    return json({ message: "Solicitacao nao encontrada" }, { status: 404 });
  }
  if (requestRecord.status !== "PENDING") {
    return json({ item: requestRecord });
  }

  const updated = await updateRequestStatus(id, nextStatus, { id: authUser.id }, reviewNote);
  if (!updated) {
    return json({ message: "Falha ao atualizar status" }, { status: 500 });
  }
  if (updated.status !== nextStatus) {
    return json({ message: "Solicitacao ja processada", item: updated }, { status: 409 });
  }

  console.info("[admin/requests] status atualizado", {
    id: updated.id,
    reviewer: authUser.id,
    status: updated.status,
  });

  if (nextStatus === "APPROVED" && updated.type === "PASSWORD_RESET") {
    const user = await getLocalUserById(updated.userId);
    if (!user) {
      return json({ message: "Usuario nao encontrado" }, { status: 404 });
    }

    const targetEmail = user.email || updated.userEmail;
    if (!targetEmail) {
      return json({ message: "Email do usuario nao encontrado" }, { status: 400 });
    }

    const token = randomUUID();
    const redisKey = `reset:${token}`;
    const redis = getRedis();
    await redis.set(redisKey, user.id, { ex: 15 * 60 });

    const emailSent = await emailService.sendPasswordResetEmail(targetEmail, token);
    if (!emailSent) {
      await redis.del(redisKey);
      return json({ message: "Falha ao enviar email de reset" }, { status: 500 });
    }
  }

  if (updated.type === "PASSWORD_RESET") {
    notifyPasswordResetStatus(updated, nextStatus).catch((err) => {
      console.error("Falha ao notificar status de reset", err);
    });
  }

  return json({ item: updated });
}
