import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { authenticateRequest } from "@/lib/jwtAuth";

type Payload = { email?: string; message?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = body.email?.toLowerCase().trim();
  const message = (body.message || "").trim();

  if (!email || !message) {
    return NextResponse.json({ message: "Email e mensagem sao obrigatorios" }, { status: 400 });
  }

  // Identifica usuário autenticado (se houver) para preencher user_id
  const authUser = await authenticateRequest(req);
  const userId = authUser?.id ?? null;

  // Contexto técnico (audit)
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;

  try {
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
