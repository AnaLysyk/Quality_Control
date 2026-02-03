import { NextResponse } from "next/server";
import { addRequest } from "@/data/requestsStore";
import { findLocalUserByEmailOrId, listLocalCompanies, listLocalLinksForUser } from "@/lib/auth/localStore";
import { notifyPasswordResetRequest } from "@/lib/notificationService";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email obrigatorio" }, { status: 400 });
  }

  const user = await findLocalUserByEmailOrId(email);
  if (!user) {
    return NextResponse.json({ ok: true });
  }

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
  try {
    requestRecord = addRequest(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        companyId: preferredCompany?.id,
        companyName: preferredCompany?.name ?? preferredCompany?.company_name,
      },
      "PASSWORD_RESET",
      { reason: "forgot_password" },
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

  return NextResponse.json({ ok: true });
}
