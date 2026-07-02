import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { requireAiApiKey } from "@/lib/ai/apiKey";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PlannerSchema = z.object({
  companySlug: z.string().trim().min(1),
  /** Summary of the test case / feature to plan */
  testCaseSummary: z.string().trim().min(1),
  /** Optional existing spec content for context */
  existingSpec: z.string().optional(),
  baseURL: z.string().default("http://localhost:3000"),
});

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PlannerSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, testCaseSummary, existingSpec, baseURL } = parsed.data;

  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen || (!access.hasGlobalCompanyVisibility && !allowed.includes(companySlug)))
    return NextResponse.json({ error: "Sem permissÃ£o" }, { status: 403 });

  const apiKey = requireAiApiKey();
  const openai = createOpenAI({ apiKey });

  const systemPrompt = `You are a senior QA automation engineer specializing in Playwright.
Your task: create a detailed test plan (as Markdown) for automating the given test case.
Include: test scenarios, pre-conditions, step-by-step description, expected results, and suggested selectors strategy.
Always write in the same language as the input. If input is in Portuguese, respond in Portuguese.`;

  const userPrompt = existingSpec
    ? `Test case summary: ${testCaseSummary}\nbaseURL: ${baseURL}\n\nExisting spec for reference:\n\`\`\`typescript\n${existingSpec.slice(0, 3000)}\n\`\`\``
    : `Test case summary: ${testCaseSummary}\nbaseURL: ${baseURL}`;

  const taskId = await persistTask(companySlug, "planner", { testCaseSummary, baseURL }, user);

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userPrompt,
    });

    await finishTask(taskId, { plan: text });
    return NextResponse.json({ plan: text, taskId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await failTask(taskId, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function persistTask(
  companySlug: string,
  agentType: string,
  inputJson: object,
  user: { id?: string; email?: string },
): Promise<string> {
  await ensureAutomationTables();
  const { rows } = await automationPool.query<{ id: string }>(
    `INSERT INTO playwright_agent_tasks (company_slug, agent_type, status, input_json, created_by)
     VALUES ($1,$2,'running',$3,$4) RETURNING id`,
    [companySlug, agentType, JSON.stringify(inputJson), user.id ?? user.email ?? null],
  );
  return rows[0].id;
}

async function finishTask(taskId: string, outputJson: object) {
  await automationPool.query(
    `UPDATE playwright_agent_tasks SET status='done', output_json=$1, finished_at=NOW() WHERE id=$2`,
    [JSON.stringify(outputJson), taskId],
  );
}

async function failTask(taskId: string, error: string) {
  await automationPool.query(
    `UPDATE playwright_agent_tasks SET status='error', error=$1, finished_at=NOW() WHERE id=$2`,
    [error, taskId],
  );
}

