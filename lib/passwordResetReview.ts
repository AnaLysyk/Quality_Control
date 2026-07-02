import { randomUUID } from "crypto";

import { getRequestById, updateRequestStatus, type RequestRecord } from "@/data/requestsStore";
import { getLocalUserById } from "@/lib/auth/localStore";
import { emailService } from "@/lib/email";
import { notifyPasswordResetStatus } from "@/lib/notificationService";
import { getRedis } from "@/lib/redis";

type PasswordResetReviewStatus = "APPROVED" | "REJECTED";

type PasswordResetReviewResult =
  | { ok: true; item: RequestRecord | null }
  | { ok: false; status: number; message: string };

export async function reviewPasswordResetRequest(
  requestId: string,
  nextStatus: PasswordResetReviewStatus,
  reviewer: { id: string },
  reviewNote?: string,
): Promise<PasswordResetReviewResult> {
  const requestRecord = await getRequestById(requestId);
  if (!requestRecord) {
    return { ok: false, status: 404, message: "Solicitacao nao encontrada" };
  }
  if (requestRecord.type !== "PASSWORD_RESET") {
    return { ok: false, status: 400, message: "Solicitacao nao e de reset de senha" };
  }
  if (requestRecord.status !== "PENDING" && requestRecord.status !== "NEEDS_REVISION") {
    return { ok: true, item: requestRecord };
  }

  if (nextStatus === "APPROVED") {
    const user = await getLocalUserById(requestRecord.userId);
    if (!user) {
      return { ok: false, status: 404, message: "Usuario nao encontrado" };
    }
    const token = randomUUID();
    const redis = getRedis();
    await redis.set(`reset:${token}`, user.id, { ex: 15 * 60 });

    const targetEmail = user.email || requestRecord.userEmail;
    if (!targetEmail) {
      return { ok: false, status: 400, message: "Email do usuario nao encontrado" };
    }

    const emailSent = await emailService.sendPasswordResetEmail(targetEmail, token);
    if (!emailSent) {
      return { ok: false, status: 500, message: "Falha ao enviar email de reset" };
    }
  }

  const updated = await updateRequestStatus(requestId, nextStatus, reviewer, reviewNote);
  if (updated) {
    try {
      await notifyPasswordResetStatus(updated, nextStatus);
    } catch (error) {
      console.error("Falha ao notificar status de reset", error);
    }
  }

  return { ok: true, item: updated };
}

