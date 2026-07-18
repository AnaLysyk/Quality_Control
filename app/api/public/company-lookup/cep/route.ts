import { NextResponse } from "next/server";
import { lookupAddressByCep } from "@/backend/company-lookup/companyLookup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cep = searchParams.get("cep") ?? "";

  try {
    const item = await lookupAddressByCep(cep);

    return NextResponse.json({
      ok: true,
      item,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível consultar o CEP.",
      },
      { status: 400 },
    );
  }
}

