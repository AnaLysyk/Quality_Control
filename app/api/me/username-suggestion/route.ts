import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { suggestNextUniqueLogin } from "@/lib/auth/localStore";

export async function POST(req: Request) {
  try {
    const access = await getAccessContext(req);
    if (!access) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | {
          seed?: unknown;
          avoid?: unknown;
        }
      | null;

    const seed = typeof body?.seed === "string" ? body.seed.trim() : "";
    if (!seed) {
      return NextResponse.json({ error: "Seed obrigatoria" }, { status: 400 });
    }

    const avoid = Array.isArray(body?.avoid)
      ? body.avoid.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    const username = await suggestNextUniqueLogin({
      seed,
      excludeUserId: access.userId,
      avoid,
    });

    return NextResponse.json({ ok: true, username }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Nao foi possivel gerar o login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
