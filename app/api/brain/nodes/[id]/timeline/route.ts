import { type NextRequest, NextResponse } from "next/server";

import { getNodeTimeline } from "@/lib/brain";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autorizado" : "Sem permissao" },
      { status },
    );
  }

  try {
    const { id } = await params;
    const timeline = await getNodeTimeline(id);

    return NextResponse.json({
      timeline: timeline.map((entry) => ({
        id: entry.id,
        action: entry.action,
        reason: entry.reason ?? null,
        timestamp: entry.timestamp,
      })),
    });
  } catch (error) {
    console.error("[brain/nodes/[id]/timeline] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar timeline" }, { status: 500 });
  }
}
