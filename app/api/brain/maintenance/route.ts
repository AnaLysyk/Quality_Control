import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { runBrainDailyMaintenance } from "@/lib/brain/maintenanceService";

function isAuthorizedByCronSecret(req: Request) {
  const expected = process.env.BRAIN_MAINTENANCE_SECRET?.trim();
  if (!expected) return false;
  const provided = req.headers.get("x-brain-maintenance-secret")?.trim();
  return Boolean(provided && provided === expected);
}

export async function POST(req: Request) {
  const cronAuthorized = isAuthorizedByCronSecret(req);
  const accessResult = cronAuthorized ? null : await resolveBrainAccess(req, { requireManage: true });

  if (!cronAuthorized && accessResult && !accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { companySlug?: string };
    const result = await runBrainDailyMaintenance({
      companySlug: body.companySlug,
      actorUserId: accessResult?.ok ? accessResult.context.user.id : "cron",
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[brain/maintenance] POST error:", error);
    return NextResponse.json({ error: "Erro ao executar manutenÃ§Ã£o diÃ¡ria do Brain" }, { status: 500 });
  }
}

