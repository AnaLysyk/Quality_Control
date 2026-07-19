import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/backend/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/backend/automations/access";
import { requireAiApiKey } from "@/backend/ai/apiKey";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { automationPool, ensureAutomationTables } from "@/database/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HealerSchema = z.object({
  companySlug: z.string().trim().min(1),
  /** The spec file content that is failing */
  specContent: z.string().trim().min(1),
  /** The error message or stack trace from the failure */
  errorOutput: z.string().trim().min(1),
  /** Optional page HTML snapshot or selector context */
  pageContext: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = HealerSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, specContent, errorOutput, pageContext } = parsed.data;

  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen || (!access.hasGlobalCompanyVisibility && !allowed.includes(companySlug)))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const apiKey = requireAiApiKey();
  const openai = createOpenAI({ apiKey });

  const systemPrompt = `You are an expert Playwright test healer.
Your task: analyze the failing Playwright spec and error output, then produce a fixed version of the spec.
Rules:
- Output ONLY the corrected TypeScript code, no explanation, no markdown fences
- Make minimal changes to fix the failure
- If selectors are broken, suggest more robust alternatives (role, text, data-testid)
- If timing is the issue, add appropriate waits
- Preserve the original test intent`;

  const userPrompt = pageContext
    ? `Failing spec:\n${specContent.slice(0, 4000)}\n\nError output:\n${errorOutput.slice(0, 2000)}\n\nPage context:\n${pageContext.slice(0, 1000)}`
    : `Failing spec:\n${specContent.slice(0, 4000)}\n\nError output:\n${errorOutput.slice(0, 2000)}`;

  await ensureAutomationTables();
  const { rows: tr } = await automationPool.query<{ id: string }>(
    `INSERT INTO playwright_agent_tasks (company_slug, agent_type, status, input_json, created_by)
     VALUES ($1,'healer','running',$2,$3) RETURNING id`,
    [companySlug, JSON.stringify({ errorSummary: errorOutput.slice(0, 200) }), user.id ?? user.email ?? null],
  );
  const taskId = tr[0].id;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      prompt: userPrompt,
    });

    const fixedCode = text.replace(/^```(?:typescript|ts)?\n?/i, "").replace(/\n?```$/i, "");
    const diff = computeSimpleDiff(specContent, fixedCode);

    await automationPool.query(
      `UPDATE playwright_agent_tasks SET status='done', output_json=$1, finished_at=NOW() WHERE id=$2`,
      [JSON.stringify({ fixedCode, diff }), taskId],
    );

    return NextResponse.json({ fixedCode, diff, taskId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await automationPool.query(
      `UPDATE playwright_agent_tasks SET status='error', error=$1, finished_at=NOW() WHERE id=$2`,
      [msg, taskId],
    );
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

/** Very lightweight line-diff summary for display purposes */
function computeSimpleDiff(original: string, fixed: string): string {
  const origLines = original.split("\n");
  const fixedLines = fixed.split("\n");
  const changes: string[] = [];
  const maxLines = Math.max(origLines.length, fixedLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (origLines[i] !== fixedLines[i]) {
      if (origLines[i] !== undefined) changes.push(`- ${origLines[i]}`);
      if (fixedLines[i] !== undefined) changes.push(`+ ${fixedLines[i]}`);
    }
  }
  return changes.slice(0, 40).join("\n");
}

