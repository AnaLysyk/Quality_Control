import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listUserRequests } from "@/data/requestsStore";
import { createUserNotification, listUserNotifications } from "@/lib/userNotificationsStore";
import { canAdminReviewQueue, resolveReviewQueue } from "@/lib/requestRouting";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const summary = url.searchParams.get("summary");

  const pendingResets = await listUserRequests(user.id, { status: "PENDING", type: "PASSWORD_RESET" });
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
    await createUserNotification(user.id, {
      type: "PASSWORD_RESET_PENDING",
      title: "Solicitacao de reset enviada",
      description: canAdminReviewQueue(queue)
        ? "Aguardando analise de Admin ou Global."
        : "Aguardando analise exclusiva do Global.",
      requestId: request.id,
      dedupeKey: `reset:user:${request.id}`,
    });
  }

  let items = await listUserNotifications(user.id);
  if (unreadOnly) {
    items = items.filter((item) => item.status !== "closed");
  }
  if (summary === "count") {
    return NextResponse.json(
      { unreadCount: items.filter((item) => item.status !== "closed").length },
      { status: 200 },
    );
  }
  return NextResponse.json({ items }, { status: 200 });
}
