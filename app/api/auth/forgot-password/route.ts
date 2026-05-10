import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { addRequest } from "@/data/requestsStore";
import { findLocalUserByEmailOrId, listLocalCompanies, listLocalLinksForUser } from "@/lib/auth/localStore";
import { notifyPasswordResetRequest } from "@/lib/notificationService";
import { rateLimit } from "@/lib/rateLimit";
import { deriveProfileTypeFromAccount, normalizeRequestProfileType, resolveReviewQueue } from "@/lib/requestRouting";

const GENERIC_MESSAGE = "Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir sua senha.";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawProfileType = typeof body?.profile_type === "string" ? body.profile_type : "";

  if (!email) {
    return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
  }

  const limiter = await rateLimit(req, `forgot-password:${email}`, 8, 60 * 10);
  if (limiter.limited) {
    // Keep public response shape generic to avoid account enumeration side channels.
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const user = await findLocalUserByEmailOrId(email);
  if (!user || (user.email ?? "").toLowerCase() !== email) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const profileType =
    normalizeRequestProfileType(rawProfileType) ??
    deriveProfileTypeFromAccount({
      role: user.role,
      globalRole: user.globalRole ?? null,
      isGlobalAdmin: user.is_global_admin === true,
    });

  const [links, companies] = await Promise.all([listLocalLinksForUser(user.id), listLocalCompanies()]);
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const preferredCompany =
    (user.default_company_slug
      ? companies.find((company) => company.slug === user.default_company_slug)
      : null) ??
    (links.length > 0 ? companyById.get(links[0].companyId) ?? null : null);

  try {
    const requestRecord = await addRequest(
      {
        id: user.id,
        name: user.full_name?.trim() || user.name,
        email: user.email,
        companyId: preferredCompany?.id,
        companyName: preferredCompany?.name ?? preferredCompany?.company_name ?? undefined,
      },
      "PASSWORD_RESET",
      {
        reason: "forgot_password",
        login: email,
        profileType,
        reviewQueue: resolveReviewQueue(profileType),
        tokenEntropy: randomBytes(16).toString("hex"),
      },
    );

    await notifyPasswordResetRequest(requestRecord);
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code !== "DUPLICATE") {
      addAuditLogSafe({
        action: "auth.password.reset_requested_error",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
      });
    }
  }

  addAuditLogSafe({
    action: "auth.password.forgot_requested",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.user ?? user.email ?? null,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    metadata: { method: "forgot_password" },
  });

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
