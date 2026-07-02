import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { executeBrainCommand, interpretBrainCommand, listBrainCommands } from "@/lib/brain/commandInterpreter";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  return NextResponse.json({
    commands: listBrainCommands(),
  });
}

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      input?: string;
      confirmed?: boolean;
    };

    const rawInput = String(body.input ?? "").trim();
    if (!rawInput) {
      return NextResponse.json({ error: "Comando obrigatório" }, { status: 400 });
    }

    const parsed = interpretBrainCommand(rawInput);
    if (!parsed.command) {
      return NextResponse.json({
        ok: false,
        error: "Não foi possível interpretar o comando informado.",
      }, { status: 400 });
    }

    const result = await executeBrainCommand({
      rawInput,
      parsed,
      access: accessResult.context,
      confirmed: body.confirmed === true,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[brain/commands] POST error:", error);
    return NextResponse.json({ error: "Erro ao executar comando Brain" }, { status: 500 });
  }
}

