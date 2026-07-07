import { NextResponse } from "next/server";

import { getQaOperationModel } from "@/data/qaOperationModel";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const guard = await requirePermission(request, "operations", "view");
    if (!guard.ok) return guard.response;

    return NextResponse.json(getQaOperationModel());
  } catch (error) {
    console.error("[quality/operation-model] GET error", error);
    return NextResponse.json({ error: "Erro ao carregar modelo operacional de QA" }, { status: 500 });
  }
}
