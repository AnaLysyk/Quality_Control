import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Upload de avatar desativado. Configure armazenamento proprio para habilitar." },
    { status: 501 },
  );
}
