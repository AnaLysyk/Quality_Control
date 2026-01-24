import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "number" || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "ID e campo 'text' obrigatórios" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("todos")
    .update({ text: body.text.trim() })
    .eq("id", body.id)
    .select();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ todo: data?.[0] ?? null });
}
