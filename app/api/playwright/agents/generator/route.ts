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

const GeneratorSchema = z.object({
  companySlug: z.string().trim().min(1),
  testCaseSummary: z.string().trim().min(1),
  targetType: z.enum(["playwright", "api"]).default("playwright"),
  repositoryCase: z.object({
    key: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    steps: z.array(z.object({ action: z.string().optional(), expectedResult: z.string().optional() })).optional(),
  }).optional(),
  /** Optional plan (from planner agent) to guide code generation */
  plan: z.string().optional(),
  baseURL: z.string().default("http://localhost:3000"),
  browser: z.string().default("chromium"),
  /** Target file name, e.g. "tests/login.spec.ts" */
  targetFile: z.string().default("tests/generated.spec.ts"),
});

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = GeneratorSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, testCaseSummary, targetType, repositoryCase, plan, baseURL, browser, targetFile } = parsed.data;

  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen || (!access.hasGlobalCompanyVisibility && !allowed.includes(companySlug)))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const apiKey = requireAiApiKey();
  const openai = createOpenAI({ apiKey });

  const systemPrompt = targetType === "api"
    ? `You are a senior QA automation engineer specialized in API testing.
Generate a JSON flow for API automation from the given test case.
Output ONLY valid JSON (no markdown fences) in this shape:
{
  "name": "...",
  "baseURL": "...",
  "steps": [
    { "name": "...", "method": "GET|POST|PUT|PATCH|DELETE", "path": "/...", "headers": {}, "body": {}, "assert": [{ "type": "status", "equals": 200 }] }
  ]
}`
    : `You are a senior QA automation engineer specializing in Playwright with TypeScript.
Generate a complete, ready-to-run Playwright spec file (.ts) for the described test case.
Requirements:
- Use @playwright/test imports only
- Follow Page Object Model pattern when appropriate
- Use descriptive test names
- Add test.beforeEach for navigation when applicable
- Handle assertions with expect()
- Output ONLY the TypeScript code, no explanation, no markdown fences
Write in the same language as the input for test.describe and test names.`;

  const repoBlock = repositoryCase
    ? `\n\nRepository case:\n${JSON.stringify(repositoryCase).slice(0, 3000)}`
    : "";

  const userPrompt = plan
    ? `Target type: ${targetType}\nFile: ${targetFile}\nbaseURL: ${baseURL}\nbrowser: ${browser}\n\nTest case: ${testCaseSummary}${repoBlock}\n\nTest plan to follow:\n${plan.slice(0, 3000)}`
    : `Target type: ${targetType}\nFile: ${targetFile}\nbaseURL: ${baseURL}\nbrowser: ${browser}\n\nTest case: ${testCaseSummary}${repoBlock}`;

  await ensureAutomationTables();
  const { rows: tr } = await automationPool.query<{ id: string }>(
    `INSERT INTO playwright_agent_tasks (company_slug, agent_type, status, input_json, created_by)
     VALUES ($1,'generator','running',$2,$3) RETURNING id`,
    [companySlug, JSON.stringify({ testCaseSummary, targetFile, baseURL, targetType }), user.id ?? user.email ?? null],
  );
  const taskId = tr[0].id;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Strip any accidental markdown fences
    const code = text.replace(/^```(?:typescript|ts)?\n?/i, "").replace(/\n?```$/i, "");

    await automationPool.query(
      `UPDATE playwright_agent_tasks SET status='done', output_json=$1, finished_at=NOW() WHERE id=$2`,
      [JSON.stringify({ code, targetFile }), taskId],
    );

    return NextResponse.json({ code, targetFile, taskId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await automationPool.query(
      `UPDATE playwright_agent_tasks SET status='error', error=$1, finished_at=NOW() WHERE id=$2`,
      [msg, taskId],
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
