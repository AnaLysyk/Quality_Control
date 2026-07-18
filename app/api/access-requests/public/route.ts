import { NextResponse } from "next/server";

import { createAccessRequestFromPayload } from "@/backend/access-requests/service";
import { rateLimit } from "@/backend/rateLimit";

const GENERIC_MESSAGE =
  "Sua solicitação foi recebida. Se os dados informados forem válidos, enviaremos atualizações pelo e-mail informado.";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const requesterEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const limiter = await rateLimit(req, `access-request-public:${requesterEmail || "anonymous"}`, 10, 60 * 10);
  if (limiter.limited) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const result = await createAccessRequestFromPayload(body, req, null);
  if (result.status >= 400) {
    if (
      result.status === 409 &&
      "code" in result.body &&
      result.body.code === "DUPLICATE_ACCESS_REQUEST"
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: result.body.code,
          message: result.body.message,
          item:
            "item" in result.body && result.body.item
              ? {
                  id: result.body.item.id,
                  status: result.body.item.status,
                  requesterEmail: result.body.item.requesterEmail,
                }
              : undefined,
        },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  }

  const item =
    "item" in result.body &&
    result.body.item &&
    "requestType" in result.body.item
      ? result.body.item
      : null;
  if (!item) {
    return NextResponse.json({ message: "Falha ao registrar solicitacao" }, { status: 500 });
  }
  return NextResponse.json(
    {
      ok: true,
      message: GENERIC_MESSAGE,
      item: {
        id: item.id,
        accessKey: item.accessKey,
        status: item.status,
        requestType: item.requestType,
        requestedRole: item.requestedRole,
        requestedCompanyId: item.requestedCompanyId,
        requestedCompanySlug: item.requestedCompanySlug,
        requesterName: item.requesterName,
        requesterEmail: item.requesterEmail,
        createdAt: item.createdAt,
      },
    },
    { status: 201 },
  );
}
