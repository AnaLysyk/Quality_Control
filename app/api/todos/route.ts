import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("todos").select();
  if (error) {
    return NextResponse.json({ todos: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ todos: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Campo 'text' obrigatório" }, { status: 400 });
  }
  const { data, error } = await supabase.from("todos").insert([{ text: body.text.trim() }]).select();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ todo: data?.[0] ?? null });
}
