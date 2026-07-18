import { NextResponse } from "next/server";
import { lookupCompanyByCnpj } from "@/backend/company-lookup/companyLookup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

    console.error("[COMPANY LOOKUP][CNPJ]", {
      cnpj,
      message,
    });

    return NextResponse.json(
      {
        ok: false,
        message,
        cnpj,
      },
      { status: 400 },
    );
  }
}

