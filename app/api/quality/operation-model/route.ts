import { NextResponse } from "next/server";

import { getQaOperationModel } from "@/data/qaOperationModel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getQaOperationModel());
  } catch (error) {
    console.error("[quality/operation-model] GET error", error);
    return NextResponse.json({ error: "Erro ao carregar modelo operacional de QA" }, { status: 500 });
  }
}
