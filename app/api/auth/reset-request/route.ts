import { NextResponse } from "next/server";
import { addRequest } from "@/data/requestsStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { findLocalUserByEmailOrId, listLocalCompanies, listLocalLinksForUser } from "@/lib/auth/localStore";
import { notifyPasswordResetRequest } from "@/lib/notificationService";
import {
  deriveProfileTypeFromAccount,
  normalizeRequestProfileType,
  resolveReviewQueue,
} from "@/lib/requestRouting";

type ResetRequestBody = {
  login: string;
  email: string;
  rawProfileType: string;
};

type ResetUser = NonNullable<Awaited<ReturnType<typeof findLocalUserByEmailOrId>>>;
type LocalCompany = Awaited<ReturnType<typeof listLocalCompanies>>[number];

async function parseResetRequestBody(req: Request): Promise<ResetRequestBody> {
  const body = await req.json().catch(() => null);
  return {
    login: typeof body?.user === "string" ? body.user.trim().toLowerCase() : "",
    email: typeof body?.email === "string" ? body.email.trim().toLowerCase() : "",
    rawProfileType: typeof body?.profile_type === "string" ? body.profile_type : "",
  };
}

async function validateResetUser(login: string, email: string) {
  if (!login || !email) {
    return NextResponse.json({ error: "UsuÃ¡rio e email obrigatorios" }, { status: 400 });
  }

  const user = await findLocalUserByEmailOrId(login);
  if (!user || (user.email ?? "").toLowerCase() !== email) {
    return NextResponse.json({ error: "UsuÃ¡rio e email nÃ£o conferem" }, { status: 400 });
  }
  return user;
}

async function resolvePreferredCompany(user: ResetUser): Promise<LocalCompany | null> {
  const [links, companies] = await Promise.all([
    listLocalLinksForUser(user.id),
    listLocalCompanies(),
  ]);
  const companyById = new Map(companies.map((company) => [company.id, company]));
  return (
    (user.default_company_slug
      ? companies.find((company) => company.slug === user.default_company_slug)
      : null) ??
    (links.length > 0 ? companyById.get(links[0].companyId) ?? null : null)
  );
}

function resolveProfileType(user: ResetUser, rawProfileType: string) {
  return (
    normalizeRequestProfileType(rawProfileType) ??
    deriveProfileTypeFromAccount({
      role: user.role,
      globalRole: user.globalRole ?? null,
      isGlobalAdmin: user.is_global_admin === true,
    })
  );
}

async function createPasswordResetRequest(user: ResetUser, login: string, rawProfileType: string, preferredCompany: LocalCompany | null) {
  const profileType = resolveProfileType(user, rawProfileType);
  const reviewQueue = resolveReviewQueue(profileType);
  const preferredCompanyName = preferredCompany?.name ?? preferredCompany?.company_name ?? undefined;

  try {
    return await addRequest(
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
        login,
        profileType,
        reviewQueue,
      },
    );
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code !== "DUPLICATE") {
      throw err;
    }
    return null;
  }
}

export async function POST(req: Request) {
  const { login, email, rawProfileType } = await parseResetRequestBody(req);
  const userOrResponse = await validateResetUser(login, email);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const user = userOrResponse;
  const preferredCompany = await resolvePreferredCompany(user);
  const preferredCompanyName = preferredCompany?.name ?? preferredCompany?.company_name ?? undefined;
  let requestRecord = null;
  try {
    requestRecord = await createPasswordResetRequest(user, login, rawProfileType, preferredCompany);
  } catch {
    return NextResponse.json({ error: "Erro ao registrar solicitaÃ§Ã£o" }, { status: 500 });
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
    entityLabel: user.user ?? user.email ?? null,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    metadata: { method: "forgot_password", companyLabel: preferredCompanyName ?? null },
  });

  return NextResponse.json({ ok: true, message: "SolicitaÃ§Ã£o enviada. O Suporte tÃ©cnico serÃ¡ notificado." });
}

