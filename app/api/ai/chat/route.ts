import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body?.message ?? "";
    // Simple echo stub — replace with real AI integration later
    const reply = `Echo: ${String(message)}`;
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
