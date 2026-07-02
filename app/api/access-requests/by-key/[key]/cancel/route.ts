import { NextResponse } from "next/server";

import { cancelAccessRequestByKey } from "@/lib/accessRequestsV2/service";

export async function POST(_req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;

  if (!key || key.length < 10) {
    return NextResponse.json({ message: "Chave invÃ¡lida" }, { status: 400 });
  }

  const result = await cancelAccessRequestByKey(key);
  if (!result) {
    return NextResponse.json({ message: "SolicitaÃ§Ã£o nÃ£o encontrada" }, { status: 404 });
  }
  if (result === "invalid-transition") {
    return NextResponse.json(
      { message: "Esta solicitaÃ§Ã£o nÃ£o pode mais ser cancelada." },
      { status: 409 },
    );
  }
  return NextResponse.json({ item: result });
}

