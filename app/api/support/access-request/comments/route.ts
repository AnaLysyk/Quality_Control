import { NextResponse } from "next/server";

import { addPublicAccessRequestComment } from "@/lib/accessRequestsV2/service";

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const accessKey = text(body.accessKey, 160);
  const name = text(body.name, 255);
  const email = text(body.email, 255).toLowerCase();
  const comment = text(body.comment ?? body.body, 2000);

  if (!accessKey || !name || !email || !comment) {
    return NextResponse.json(
      { error: "Informe chave, nome, e-mail e comentario." },
      { status: 400 },
    );
  }

  const result = await addPublicAccessRequestComment({
    accessKey,
    name,
    email,
    comment,
  });

  if (!result) return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
  if (result === "forbidden") {
    return NextResponse.json({ error: "Dados nao conferem com a solicitacao." }, { status: 403 });
  }
  if (result === "final") {
    return NextResponse.json(
      { error: "Solicitacao finalizada nao aceita comentarios." },
      { status: 409 },
    );
  }

  return NextResponse.json({ item: result });
}

