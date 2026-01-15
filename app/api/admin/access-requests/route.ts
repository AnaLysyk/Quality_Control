import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });

    let service;
    try {
      service = getSupabaseServer();
    } catch {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const { data, error } = await service
      .from("support_requests")
      .select("id,email,message,status,created_at,admin_notes")
      .or("message.ilike.ACCESS_REQUEST_V1%,message.ilike.Solicitacao de acesso%")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
