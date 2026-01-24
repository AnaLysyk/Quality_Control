import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
