import { NextRequest, NextResponse } from "next/server";

import { extractCnpjCompanyName, normalizeCnpj, type BrasilApiCnpjLookup } from "@/lib/brasilApiCnpj";

export const runtime = "nodejs";
export const revalidate = 0;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: rawCnpj } = await params;
  const cnpj = normalizeCnpj(rawCnpj);

  if (cnpj.length !== 14) {
    return jsonError("CNPJ invalido", 400);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const data = (await response.json().catch(() => null)) as BrasilApiCnpjLookup | null;
    if (!response.ok || !data) {
      return jsonError("CNPJ nao encontrado", response.status === 404 ? 404 : 502);
    }

    const companyName = extractCnpjCompanyName(data);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return NextResponse.json(
      {
        cnpj,
        nome_fantasia: str(data.nome_fantasia),
        razao_social: str(data.razao_social),
        company_name: companyName || null,
        cep: str(data.cep),
        logradouro: str(data.logradouro),
        numero: str(data.numero),
        complemento: str(data.complemento),
        bairro: str(data.bairro),
        municipio: str(data.municipio),
        uf: str(data.uf),
        ddd_telefone_1: str(data.ddd_telefone_1),
        ddd_telefone_2: str(data.ddd_telefone_2),
        email: str(data.email),
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return jsonError("Consulta a BrasilAPI demorou demais", 504);
    }
    return jsonError("Nao foi possivel consultar a BrasilAPI", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
