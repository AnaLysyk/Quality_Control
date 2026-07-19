import { NextResponse } from "next/server";

import { cancelAccessRequestByKey } from "@/backend/access-requests/service";
import { rateLimit } from "@/backend/rateLimit";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";

export async function POST(req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;

  if (!key || key.length < 10 || key.length > 160) {
    return NextResponse.json({ message: "Chave inválida" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const limiter = await rateLimit(req, `access-request-cancel-by-key:${key}`, 5, 60);
  if (limiter.limited) return limiter.response;

  const result = await cancelAccessRequestByKey(key);
  if (!result) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404, headers: NO_STORE_HEADERS });
  }
  if (result === "invalid-transition") {
    return NextResponse.json(
      { message: "Esta solicitação não pode mais ser cancelada." },
      { status: 409 },
    );
  }
  return NextResponse.json({ item: result }, { headers: NO_STORE_HEADERS });
}
