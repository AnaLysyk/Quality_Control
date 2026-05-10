import { NextResponse } from "next/server";

import { createAccessRequestFromPayload } from "@/lib/accessRequestsV2/service";
import { rateLimit } from "@/lib/rateLimit";

const GENERIC_MESSAGE = "Sua solicitação foi recebida. Se os dados informados forem válidos, enviaremos atualizações pelo e-mail informado.";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requesterEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const limiter = await rateLimit(req, `access-request-public:${requesterEmail || "anonymous"}`, 10, 60 * 10);
  if (limiter.limited) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const result = await createAccessRequestFromPayload(body, req, null);
  if (result.status >= 400) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE, item: result.body.item }, { status: 201 });
}
