import { NextResponse } from "next/server";

import { getAccessRequestV2ByKey, updateAccessRequestV2 } from "@/lib/accessRequestsV2/repository";

export async function POST(_req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;

  if (!key || key.length < 10) {
    return NextResponse.json({ message: "Chave inválida" }, { status: 400 });
  }

  const request = await getAccessRequestV2ByKey(key);

  if (!request) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });
  }

  if (["approved", "rejected", "cancelled", "expired"].includes(request.status)) {
    return NextResponse.json(
      { message: "Esta solicitação não pode mais ser cancelada." },
      { status: 409 },
    );
  }

  const updated = await updateAccessRequestV2(request.id, {
    status: "cancelled",
    reviewComment: "Solicitação cancelada pelo solicitante.",
  });

  return NextResponse.json({ item: updated });
}