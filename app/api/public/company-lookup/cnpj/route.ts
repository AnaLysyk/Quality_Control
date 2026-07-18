import { NextResponse } from "next/server";
import { lookupCompanyByCnpj } from "@/backend/company-lookup/companyLookup";
import { rateLimit } from "@/backend/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limiter = await rateLimit(request, "public-company-lookup-cnpj", 20, 60);
  if (limiter.limited) return limiter.response;

  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get("cnpj") ?? "";

  try {
    const item = await lookupCompanyByCnpj(cnpj);

    return NextResponse.json({
      ok: true,
      item,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível consultar o CNPJ.";

    console.error("[COMPANY LOOKUP][CNPJ]", message);

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    );
  }
}
