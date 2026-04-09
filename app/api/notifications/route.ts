import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listUserRequests } from "@/data/requestsStore";
import { countUnreadUserNotifications, createUserNotification, listUserNotifications } from "@/lib/userNotificationsStore";
import { canAdminReviewQueue, resolveReviewQueue } from "@/lib/requestRouting";

const PENDING_RESET_SYNC_TTL_MS = 60_000;

type NotificationsGlobalState = typeof globalThis & {
  __qcPendingResetSync?: Map<string, number>;
};

function shouldSyncPendingResets(userId: string) {
  const globalState = globalThis as NotificationsGlobalState;
  if (!globalState.__qcPendingResetSync) {
    globalState.__qcPendingResetSync = new Map<string, number>();
  }
  const cache = globalState.__qcPendingResetSync;
  const lastSyncAt = cache.get(userId) ?? 0;
  if (lastSyncAt > Date.now() - PENDING_RESET_SYNC_TTL_MS) {
    return false;
  }
  cache.set(userId, Date.now());
  return true;
}

async function syncPendingResetNotifications(userId: string) {
  if (!shouldSyncPendingResets(userId)) return;

  const pendingResets = await listUserRequests(userId, { status: "PENDING", type: "PASSWORD_RESET" });
  for (const request of pendingResets) {
    const queue =
      typeof request.payload?.reviewQueue === "string" &&
      (request.payload.reviewQueue === "admin_and_global" || request.payload.reviewQueue === "global_only")
        ? request.payload.reviewQueue
        : resolveReviewQueue(
            typeof request.payload?.profileType === "string" &&
              (request.payload.profileType === "testing_company_user" ||
                request.payload.profileType === "company_user" ||
                request.payload.profileType === "testing_company_lead" ||
                request.payload.profileType === "technical_support")
              ? request.payload.profileType
              : "testing_company_user",
          );
    await createUserNotification(userId, {
      type: "PASSWORD_RESET_PENDING",
      title: "Solicitacao de reset enviada",
      description: canAdminReviewQueue(queue)
        ? "Aguardando analise de Admin ou Global."
        : "Aguardando analise exclusiva do Global.",
      requestId: request.id,
      dedupeKey: `reset:user:${request.id}`,
    });
  }
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const summary = url.searchParams.get("summary");

  if (summary === "count") {
    return NextResponse.json({ unreadCount: await countUnreadUserNotifications(user.id) }, { status: 200 });
  }

  await syncPendingResetNotifications(user.id);

  let items = await listUserNotifications(user.id);
  if (unreadOnly) {
    items = items.filter((item) => item.status !== "closed");
  }
  return NextResponse.json({ items }, { status: 200 });
}
