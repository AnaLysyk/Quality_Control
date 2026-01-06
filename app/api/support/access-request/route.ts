import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { authenticateRequest } from "@/lib/jwtAuth";

type Payload = {
  email?: string;
  company?: string;
  name?: string;
  role?: string;
  message?: string;
};

export async function POST(req: Request) {
  const supabaseServer = getSupabaseServer();
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = body.email?.toLowerCase().trim();
  const company = (body.company || "").trim();
  const name = (body.name || "").trim();
  const role = (body.role || "").trim();
  const message = (body.message || "").trim();

  if (!email || !company || !name || !role || !message) {
    return NextResponse.json({ message: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const authUser = await authenticateRequest(req);
  const userId = authUser?.id ?? null;
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;

  // Como a tabela support_requests não tem colunas company/name/role,
  // adicionamos esses dados no corpo da mensagem para manter a compatibilidade.
  const composedMessage = `Empresa: ${company}\nNome: ${name}\nCargo: ${role}\nMensagem: ${message}`;

  try {
    await supabaseServer.from("support_requests").insert({
      email,
      message: composedMessage,
      status: "open",
      ip_address,
      user_agent,
      user_id: userId,
    });
  } catch (err) {
    console.error("Erro ao registrar support_request:", err);
    // Resposta neutra para o cliente, mas loga no servidor
    return NextResponse.json({ message: "Erro interno ao registrar solicitação" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitação enviada. O administrador será notificado.",
  });
}

export async function GET(req: Request) {
  // Apenas admins podem listar
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabaseServer = getSupabaseServer();
  const { data: userRow, error: userError } = await supabaseServer
    .from("users")
    .select("id, is_global_admin")
    .eq("id", authUser.id)
    .maybeSingle();

  if (userError || !userRow || !userRow.is_global_admin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseServer
    .from("support_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar support_requests:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
