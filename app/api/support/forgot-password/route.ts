import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { createSupportRequest } from "@/data/supportRequestsStore";

export const runtime = "nodejs";

type Payload = {
  email?: string;
  company?: string;
  role?: string;
  name?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!email || !company || !role || !name) {
    return NextResponse.json({ message: "Empresa, cargo, nome e e-mail sao obrigatorios" }, { status: 400 });
  }

  const message = [
    "Solicitacao de acesso ao admin",
    `Empresa: ${company}`,
    `Cargo: ${role}`,
    `Nome: ${name}`,
    `Email: ${email}`,
  ].join("\n");

  const authUser = await authenticateRequest(req);
  const userId = authUser?.id ?? null;
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;

  try {
    await createSupportRequest({
      email,
      message,
      status: "open",
      ip_address,
      user_agent,
      user_id: userId,
    });
  } catch (err) {
    // Do not block user flow if persistence fails.
    console.error("Erro ao registrar support_request:", err);
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitacao enviada. O administrador sera notificado.",
  });
}

