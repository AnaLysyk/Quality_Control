import { NextResponse } from "next/server";

import { getRunOperationModel } from "@/data/runOperationModel";
import { requirePermission } from "@/backend/rbac/requirePermission";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const guard = await requirePermission(request, "runs", "view");
    if (!guard.ok) return guard.response;

    return NextResponse.json(getRunOperationModel());
  } catch (error) {
    console.error("[quality/run-operation-model] GET error", error);
    return NextResponse.json({ error: "Erro ao carregar modelo operacional de Run" }, { status: 500 });
  }
}
