import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { authenticateRequest } from "@/lib/jwtAuth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { data: userRow, error: userError } = await supabaseServer
    .from("users")
    .select("id, is_global_admin")
    .eq("id", authUser.id)
    .maybeSingle();

  if (userError || !userRow || !userRow.is_global_admin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const status = (body?.status as string | undefined)?.toLowerCase();
  const admin_notes = (body?.admin_notes as string | undefined) || null;

  if (!status || !["open", "in_progress", "closed"].includes(status)) {
    return NextResponse.json({ message: "Status inválido" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("support_requests")
    .update({
      status,
      admin_notes,
      handled_by: authUser.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar support_request:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
