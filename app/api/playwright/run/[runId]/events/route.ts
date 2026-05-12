import { authenticateRequest } from "@/lib/jwtAuth";
import { getRunEmitter } from "@/lib/playwright/executionService";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const user = await authenticateRequest(request);
  if (!user) {
    return new Response("Não autorizado", { status: 401 });
  }

  const { runId } = await params;
  if (!runId || !/^[a-f0-9\-]{32,36}$/.test(runId)) {
    return new Response("runId inválido", { status: 400 });
  }

  // Load run from DB to validate ownership
  await ensureAutomationTables();
  const { rows } = await automationPool.query<{ company_slug: string; status: string }>(
    `SELECT company_slug, status FROM playwright_runs WHERE id=$1`,
    [runId],
  );
  if (!rows.length) return new Response("Run não encontrada", { status: 404 });

  const { company_slug: companySlug, status } = rows[0];
  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen || (!access.hasGlobalCompanyVisibility && !allowed.includes(companySlug))) {
    return new Response("Sem permissão", { status: 403 });
  }

  // If run already finished (from a previous page load), send synthetic done event
  if (["passed", "failed", "error"].includes(status)) {
    const body = `data: ${JSON.stringify({ type: "done", status })}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const emitter = getRunEmitter(runId);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      function sendLine(line: string) {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "line", line })}\n\n`));
        } catch {
          /* client disconnected */
        }
      }

      function sendDone() {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch {
          /* already closed */
        }
      }

      if (!emitter) {
        // Run not in memory (process restarted?), close gracefully
        sendLine("[system] Run em execução em outro processo ou já concluída.");
        sendDone();
        return;
      }

      if (emitter.finished) {
        sendDone();
        return;
      }

      emitter.on("line", sendLine);
      emitter.once("done", () => {
        emitter.off("line", sendLine);
        sendDone();
      });

      // Cleanup if client disconnects
      request.signal.addEventListener("abort", () => {
        emitter.off("line", sendLine);
        emitter.off("done", sendDone);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
