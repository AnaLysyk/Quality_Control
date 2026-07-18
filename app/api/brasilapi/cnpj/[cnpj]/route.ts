import { NextRequest, NextResponse } from "next/server";

import { normalizeCnpj } from "@/backend/brasilApiCnpj";
import { lookupCompanyByCnpj } from "@/backend/company-lookup/companyLookup";

export const runtime = "nodejs";
export const revalidate = 0;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function nullable(value: string | null | undefined) {
  return value && value.trim() ? value.trim() : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: rawCnpj } = await params;
  const cnpj = normalizeCnpj(rawCnpj);

  if (cnpj.length !== 14) {
    return jsonError("CNPJ inválido", 400);
  }

  try {
    const item = await lookupCompanyByCnpj(cnpj);
    const companyName = item.companyName || item.fantasyName || "";

    return NextResponse.json(
      {
        cnpj: item.cnpj || cnpj,
        nome_fantasia: nullable(item.fantasyName),
        razao_social: nullable(item.companyName),
        company_name: nullable(companyName),
        descricao_situacao_cadastral: nullable(item.situation),
        data_situacao_cadastral: null,
        cnae_fiscal_descricao: nullable(item.mainActivity),
        natureza_juridica: nullable(item.legalNature),
        capital_social: nullable(item.shareCapital),
        porte: nullable(item.size),
        opcao_pelo_simples: null,
        data_opcao_pelo_simples: null,
        abertura: nullable(item.openingDate),
        cep: nullable(item.cep),
        logradouro: nullable(item.address),
        numero: nullable(item.number),
        complemento: nullable(item.complement),
        bairro: nullable(item.district),
        municipio: nullable(item.city),
        uf: nullable(item.state),
        ddd_telefone_1: nullable(item.phone),
        ddd_telefone_2: nullable(item.phone2),
        email: nullable(item.email),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar o CNPJ.";
    return jsonError(message, 400);
  }
}
