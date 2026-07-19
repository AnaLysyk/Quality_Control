import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { canAccessTestCaseRecord } from "@/backend/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/backend/test-cases/testCaseRepository";
import { getAutomationDraft, recordAutomationAgentRun, updateAutomationDraft } from "@/backend/test-cases/automationDraftsStore";

type HealOutput = {
  cause: string;
  suggestions: string[];
  shouldMarkBroken: boolean;
};

function inferCause(errorMessage: string) {
  const lower = errorMessage.toLowerCase();
  if (lower.includes("timeout")) return "timeout_or_flakiness";
  if (lower.includes("locator") || lower.includes("not found")) return "locator_break";
  if (lower.includes("401") || lower.includes("403") || lower.includes("não autorizado")) return "auth_or_permission";
  if (lower.includes("500") || lower.includes("internal")) return "backend_failure";
  return "assertion_or_flow_mismatch";
}

function buildHealOutput(errorMessage: string): HealOutput {
  const cause = inferCause(errorMessage);
  const suggestions: string[] = [];

  if (cause === "timeout_or_flakiness") {
    suggestions.push("Adicionar espera orientada por estado visível antes do assert.");
    suggestions.push("Verificar dependência de dados antes da navegação.");
  } else if (cause === "locator_break") {
    suggestions.push("Substituir locator frágil por getByRole/getByTestId/getByLabel.");
    suggestions.push("Revisar mudanças recentes de UI no componente alvo.");
  } else if (cause === "auth_or_permission") {
    suggestions.push("Validar sessão/cookies e escopo da empresa no teste.");
    suggestions.push("Confirmar perfil com permissão para o fluxo." );
  } else if (cause === "backend_failure") {
    suggestions.push("Inspecionar resposta da API e logs de erro backend.");
    suggestions.push("Isolar cenário com preparação de estado via API." );
  } else {
    suggestions.push("Revisar mapeamento de passos manuais para test.step.");
    suggestions.push("Comparar resultado esperado versus assert do script." );
  }

  return {
    cause,
    suggestions,
    shouldMarkBroken: cause === "locator_break" || cause === "backend_failure",
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  const errorMessage = typeof body?.errorMessage === "string" ? body.errorMessage : "Falha não especificada.";
  if (!draftId) return NextResponse.json({ message: "draftId é obrigatório" }, { status: 400 });

  const draft = await getAutomationDraft(record.testCase.id, draftId);
  if (!draft) return NextResponse.json({ message: "Draft não encontrado" }, { status: 404 });

  const heal = buildHealOutput(errorMessage);
  const healNote = `[HealingAgent] cause=${heal.cause}; suggestions=${heal.suggestions.join(" | ")}`;
  const updated = await updateAutomationDraft(record.testCase.id, draftId, {
    reviewNotes: `${draft.reviewNotes ? `${draft.reviewNotes}\n` : ""}${healNote}`,
  });

  await recordAutomationAgentRun(
    record.testCase.id,
    user.id,
    "HealingAgent",
    {
      draftId,
      errorMessage,
    },
    heal,
    "completed",
  );

  return NextResponse.json({
    testCaseId: record.testCase.id,
    draft: updated,
    heal,
  });
}
