import { NextResponse } from "next/server";
import { addRequest } from "@/data/requestsStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { findLocalUserByEmailOrId, listLocalCompanies, listLocalLinksForUser } from "@/lib/auth/localStore";
import { notifyPasswordResetRequest } from "@/lib/notificationService";
import {
  deriveProfileTypeFromAccount,
  normalizeRequestProfileType,
  resolveReviewQueue,
  resolveRequestQueueMessage,
} from "@/lib/requestRouting";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const login = typeof body?.user === "string" ? body.user.trim().toLowerCase() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawProfileType = typeof body?.profile_type === "string" ? body.profile_type : "";

  if (!login || !email) {
    return NextResponse.json({ error: "Usuario e email obrigatorios" }, { status: 400 });
  }

  const user = await findLocalUserByEmailOrId(login);
  if (!user) {
    return NextResponse.json({ error: "Usuario e email nao conferem" }, { status: 400 });
  }
  if ((user.email ?? "").toLowerCase() !== email) {
    return NextResponse.json({ error: "Usuario e email nao conferem" }, { status: 400 });
  }

  const profileType =
    normalizeRequestProfileType(rawProfileType) ??
    deriveProfileTypeFromAccount({
      role: user.role,
      globalRole: user.globalRole ?? null,
      isGlobalAdmin: user.is_global_admin === true,
    });
  const reviewQueue = resolveReviewQueue(profileType);

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(user.id),
    listLocalCompanies(),
  ]);
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const preferredCompany =
    (user.default_company_slug
      ? companies.find((company) => company.slug === user.default_company_slug)
      : null) ??
    (links.length > 0 ? companyById.get(links[0].companyId) ?? null : null);

  let requestRecord = null;
  const preferredCompanyName =
    preferredCompany?.name ?? preferredCompany?.company_name ?? undefined;
  try {
    requestRecord = await addRequest(
      {
        id: user.id,
        name: user.full_name?.trim() || user.name,
        email: user.email,
        companyId: preferredCompany?.id,
        companyName: preferredCompanyName,
      },
      "PASSWORD_RESET",
      {
        reason: "forgot_password",
        profileType,
        reviewQueue,
      },
    );
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code !== "DUPLICATE") {
      return NextResponse.json({ error: "Erro ao registrar solicitacao" }, { status: 500 });
    }
  }

  if (requestRecord) {
    try {
      await notifyPasswordResetRequest(requestRecord);
    } catch (err) {
      console.error("Falha ao notificar reset de senha", err);
    }
  }

  addAuditLogSafe({
    action: "auth.password.reset_requested",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email ?? null,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    metadata: { method: "forgot_password", companyLabel: preferredCompanyName ?? null },
  });

  return NextResponse.json({ ok: true, message: resolveRequestQueueMessage(reviewQueue) });
}
