import { NextResponse } from "next/server";

import {
  getBrainQaSummary,
  listBrainEvalCases,
  listBrainPromptTemplates,
  listBrainQuickActions,
} from "@/data/brainQaRegistry";
import { resolveBrainAccess } from "@/lib/brain/access";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: getBrainQaSummary(),
      evals: listBrainEvalCases(),
      prompts: listBrainPromptTemplates(),
      quickActions: listBrainQuickActions(),
      guidance: {
        purpose: "Transformar o Brain em central de QA com validacao, prompt registry, acoes rapidas e evidencia rastreavel.",
        nextStep: "Rodar os evals contra respostas reais do chat e registrar resultado por versao de prompt.",
      },
    });
  } catch (error) {
    console.error("[brain/qa-registry] GET error", error);
    return NextResponse.json({ error: "Erro ao carregar registry QA do Brain" }, { status: 500 });
  }
}

