import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { listUserRequests } from "@/data/requestsStore";
import { countUnreadUserNotifications, createUserNotification, listUserNotifications } from "@/backend/userNotificationsStore";
import { canAdminReviewQueue, normalizeRequestProfileType, resolveReviewQueue } from "@/backend/access-requests/routing";

const PENDING_RESET_SYNC_TTL_MS = 60_000;
const UNREAD_COUNT_CACHE_TTL_MS = 5 * 60_000;

type NotificationsGlobalState = typeof globalThis & {
  __qcPendingResetSync?: Map<string, number>;
  __qcUnreadCountCache?: Map<string, { unreadCount: number; expiresAt: number }>;
  __qcUnreadCountInflight?: Map<string, Promise<number>>;
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

function getUnreadCountCache() {
  const globalState = globalThis as NotificationsGlobalState;
  if (!globalState.__qcUnreadCountCache) {
    globalState.__qcUnreadCountCache = new Map();
  }
  return globalState.__qcUnreadCountCache;
}

function getUnreadCountInflight() {
  const globalState = globalThis as NotificationsGlobalState;
  if (!globalState.__qcUnreadCountInflight) {
    globalState.__qcUnreadCountInflight = new Map();
  }
  return globalState.__qcUnreadCountInflight;
}

async function getCachedUnreadCount(userId: string) {
  const cache = getUnreadCountCache();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { unreadCount: cached.unreadCount, cache: "hit" as const };
  }

  const inflight = getUnreadCountInflight();
  let pending = inflight.get(userId);
  if (!pending) {
    pending = countUnreadUserNotifications(userId).finally(() => {
      inflight.delete(userId);
    });
    inflight.set(userId, pending);
  }

  const unreadCount = await pending;
  cache.set(userId, {
    unreadCount,
    expiresAt: Date.now() + UNREAD_COUNT_CACHE_TTL_MS,
  });
  return { unreadCount, cache: "miss" as const };
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
            typeof request.payload?.profileType === "string"
              ? normalizeRequestProfileType(request.payload.profileType) ?? "testing_company_user"
              : "testing_company_user",
          );
    await createUserNotification(userId, {
      type: "PASSWORD_RESET_PENDING",
      title: "Solicitação de reset enviada",
      description: canAdminReviewQueue(queue)
        ? "Aguardando análise de Admin ou Global."
        : "Aguardando análise exclusiva do Global.",
      requestId: request.id,
      dedupeKey: `reset:user:${request.id}`,
    });
  }
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const summary = url.searchParams.get("summary");

  if (summary === "count") {
    const result = await getCachedUnreadCount(user.id);
    return NextResponse.json(
      { unreadCount: result.unreadCount },
      { status: 200, headers: { "x-qc-cache": result.cache, "Cache-Control": "private, max-age=30" } },
    );
  }

  await syncPendingResetNotifications(user.id);

  let items = await listUserNotifications(user.id);
  if (unreadOnly) {
    items = items.filter((item) => item.status !== "closed");
  }
  return NextResponse.json({ items }, { status: 200 });
}
