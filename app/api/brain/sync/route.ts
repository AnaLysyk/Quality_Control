import { type NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { syncBrain } from "@/lib/brain-sync";

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autorizado" : "Sem permissao" },
      { status },
    );
  }

  try {
    const result = await syncBrain();
    return NextResponse.json({
      ok: true,
      nodeCount: result.nodeCount,
      edgeCount: result.edgeCount,
      duration: result.duration,
    });
  } catch (error) {
    console.error("[brain/sync] POST error:", error);
    return NextResponse.json({ error: "Erro ao sincronizar Brain" }, { status: 500 });
  }
}
