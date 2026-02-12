import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";

const ASSISTANT_ENABLED = process.env.AI_ASSISTANT_ENABLED !== "false";

export async function POST(req: Request) {
  if (!ASSISTANT_ENABLED) {
    return NextResponse.json({ error: "Assistente desativado" }, { status: 410 });
  }

  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = body?.message ?? "";
    // Simple echo stub — replace with real AI integration later
    const reply = `Echo: ${String(message)}`;
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
