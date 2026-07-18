import { NextResponse } from "next/server";

import { cancelAccessRequestByKey } from "@/backend/accessRequestsV2/service";

export async function POST(_req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;

  if (!key || key.length < 10) {
    return NextResponse.json({ message: "Chave inválida" }, { status: 400 });
  }

  const result = await cancelAccessRequestByKey(key);
  if (!result) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });
  }
  if (result === "invalid-transition") {
    return NextResponse.json(
      { message: "Esta solicitação não pode mais ser cancelada." },
      { status: 409 },
    );
  }
  return NextResponse.json({ item: result });
}

