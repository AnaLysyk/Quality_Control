import { NextResponse } from "next/server";

import { getRunOperationModel } from "@/data/runOperationModel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getRunOperationModel());
  } catch (error) {
    console.error("[quality/run-operation-model] GET error", error);
    return NextResponse.json({ error: "Erro ao carregar modelo operacional de Run" }, { status: 500 });
  }
}
