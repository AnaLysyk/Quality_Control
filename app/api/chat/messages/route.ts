import { NextResponse } from "next/server";

let messages: Array<{ id: number; user: string; text: string; timestamp: number }> = [];

export async function GET() {
  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  const { user, text } = await req.json();
  if (!user || !text) {
    return NextResponse.json({ error: "Missing user or text" }, { status: 400 });
  }
  const msg = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    user: String(user),
    text: String(text),
    timestamp: Date.now(),
  };
  messages.push(msg);
  // Limita a 100 mensagens em memória
  if (messages.length > 100) messages = messages.slice(-100);
  return NextResponse.json(msg);
}
