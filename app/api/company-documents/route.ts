import { NextResponse } from "next/server";

// Stub simples: retorna lista vazia; substitua por acesso ao banco com auth/token.
export async function GET() {
  return NextResponse.json([]);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  // TODO: validar auth, company_id, permissões; gravar no banco.
  return NextResponse.json({ ok: true, document: body });
}
