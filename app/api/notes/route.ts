import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const hasSupabaseConfig =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasSupabaseConfig) {
    return NextResponse.json({ notes: [], error: "Supabase não configurado" }, { status: 500 });
  }

  try {
    const supabase = await createClient();
    const { data: notes, error } = await supabase.from("notes").select("id,title");
    if (error) {
      return NextResponse.json({ notes: [], error: error.message }, { status: 500 });
    }
    return NextResponse.json({ notes });
  } catch (err) {
    return NextResponse.json({ notes: [], error: "Erro ao consultar notas" }, { status: 500 });
  }
}
