import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { listTestCaseRecords } from "@/lib/test-cases/testCaseRepository";
import { filterTestCasesByPermission } from "@/lib/test-cases/testCasePermissions";
import { listLatestAutomationDraftsByTestCase } from "@/lib/test-cases/automationDraftsStore";
import type { AutomationDraft } from "@/lib/test-cases/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type QueueBucket = "backlog" | "in_progress" | "automated";

function bucketFor(draft: AutomationDraft | undefined): QueueBucket {
  if (!draft || draft.status === "discarded") return "backlog";
  if (draft.status === "linked" && draft.githubPublication?.status === "published") return "automated";
  return "in_progress";
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug");
  if (!companySlug) {
    return NextResponse.json({ message: "companySlug é obrigatório" }, { status: 400 });
  }

  const [records, latestDrafts] = await Promise.all([
    listTestCaseRecords({ companyId: companySlug }),
    listLatestAutomationDraftsByTestCase(),
  ]);

  const visibleRecords = filterTestCasesByPermission(records, user);

  const buckets: Record<QueueBucket, Array<{
    testCase: (typeof visibleRecords)[number]["testCase"];
    draft: AutomationDraft | null;
  }>> = {
    backlog: [],
    in_progress: [],
    automated: [],
  };

  for (const record of visibleRecords) {
    const draft = latestDrafts.get(record.testCase.id);
    const bucket = bucketFor(draft);
    buckets[bucket].push({ testCase: record.testCase, draft: draft ?? null });
  }

  return NextResponse.json({
    backlog: buckets.backlog,
    inProgress: buckets.in_progress,
    automated: buckets.automated,
    counts: {
      backlog: buckets.backlog.length,
      inProgress: buckets.in_progress.length,
      automated: buckets.automated.length,
    },
  });
}
