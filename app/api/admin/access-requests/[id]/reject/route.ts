import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";

export const runtime = "nodejs";


function sanitize(value: unknown, max = 1000): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = sanitize(body.reason ?? body.admin_notes, 800);

    if (SUPABASE_MOCK) {
      return NextResponse.json({ ok: true, closed: true }, { status: 200 });
    }

    const service = getSupabaseServer();
    const adminNotes = reason ? `Recusado: ${reason}` : "Recusado";

    const { error } = await service
      .from("support_requests")
      .update({ status: "closed", admin_notes: adminNotes })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Falha ao recusar solicitacao" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, closed: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
