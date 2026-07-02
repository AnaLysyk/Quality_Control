import { NextResponse } from "next/server";

import { getBrainGaps } from "@/lib/brain";
import { resolveBrainAccess } from "@/lib/brain/access";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const requestedCompanySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() ?? null;
  const sampleSize = Math.min(50, Math.max(1, Number(url.searchParams.get("sampleSize") ?? 10)));

  const companySlug = accessResult.context.hasGlobalVisibility
    ? requestedCompanySlug ?? undefined
    : requestedCompanySlug && accessResult.context.allowedCompanySlugs.has(requestedCompanySlug)
      ? requestedCompanySlug
      : Array.from(accessResult.context.allowedCompanySlugs)[0];

  if (!accessResult.context.hasGlobalVisibility && requestedCompanySlug && requestedCompanySlug !== companySlug) {
    return NextResponse.json({ error: "Sem permissao para consultar lacunas desta empresa" }, { status: 403 });
  }

  try {
    const gaps = await getBrainGaps({ companySlug, sampleSize });
    return NextResponse.json({
      companySlug: companySlug ?? null,
      ...gaps,
    });
  } catch (error) {
    console.error("[brain/graph/gaps] GET error:", error);
    return NextResponse.json({ error: "Erro ao calcular lacunas do grafo" }, { status: 500 });
  }
}

