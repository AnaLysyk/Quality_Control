import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { BrainGraphRagService } from "@/lib/brain/graphRagService";

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { query?: string; companySlug?: string };
    const service = new BrainGraphRagService();
    const context = await service.buildGlobalContext({
      query: body.query,
      companySlug: body.companySlug,
      access: accessResult.context,
    });

    return NextResponse.json(context);
  } catch (error) {
    console.error("[brain/query/global] POST error:", error);
    return NextResponse.json({ error: "Erro ao montar contexto global do Brain" }, { status: 500 });
  }
}

