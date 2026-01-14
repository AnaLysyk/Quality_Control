import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { authenticateRequest } from "@/lib/jwtAuth";

type Payload = {
  email?: string;
  company?: string;
  role?: string;
  name?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = body.email?.toLowerCase().trim();
  const company = (body.company || "").trim();
  const role = (body.role || "").trim();
  const name = (body.name || "").trim();

  if (!email || !company || !role || !name) {
    return NextResponse.json(
      { message: "Empresa, cargo, nome e e-mail sao obrigatorios" },
      { status: 400 },
    );
  }

  const message = [
    "Solicitacao de acesso ao admin",
    `Empresa: ${company}`,
    `Cargo: ${role}`,
    `Nome: ${name}`,
    `Email: ${email}`,
  ].join("\n");

  // Identifica usuário autenticado (se houver) para preencher user_id
  const authUser = await authenticateRequest(req);
  const userId = authUser?.id ?? null;

  // Contexto técnico (audit)
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;

  try {
    const supabaseServer = getSupabaseServer();
    await supabaseServer.from("support_requests").insert({
      email,
      message,
      status: "open",
      ip_address,
      user_agent,
      user_id: userId,
    });
  } catch (err) {
    // Não vaza detalhes; apenas loga no servidor
    console.error("Erro ao registrar support_request:", err);
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitacao enviada. O administrador sera notificado.",
  });
}
