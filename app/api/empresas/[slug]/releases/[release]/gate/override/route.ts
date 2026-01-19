import { NextResponse } from "next/server";
import { appendQualityGateHistory, QualityGateHistoryEntry } from "@/lib/qualityGateHistory";
import { randomUUID } from "crypto";
import { getMockRole } from "@/lib/rbac/defects";
import { sendQualityAlert } from "@/lib/qualityAlert";

export async function POST(req: Request, context: { params: Promise<{ slug: string; release: string }> }) {
  const { slug, release } = await context.params;
  let user: { id: string; email: string; role: string } | null = null;
  // Simples: mock role para dev, ou extraia do auth real
  const mockRole = await getMockRole();
  if (mockRole === "admin") {
    user = { id: "mock-admin", email: "admin@empresa.com", role: "admin" };
  }
  // TODO: Integrar com autenticação real se necessário
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const reason = (body.reason || "").trim();
  if (!reason) {
    return NextResponse.json({ error: "Motivo obrigatório" }, { status: 400 });
  }
  const now = new Date().toISOString();
  // O gate_status e métricas podem ser passados no body ou buscados do último snapshot
  const gate_status = body.gate_status || "failed";
  const mttr_hours = body.mttr_hours || 0;
  const open_defects = body.open_defects || 0;
  const fail_rate = body.fail_rate || 0;
  const reasons = body.reasons || ["Override manual"];
  const entry: QualityGateHistoryEntry = {
    id: randomUUID(),
    company_slug: slug,
    release_slug: release,
    gate_status,
    mttr_hours,
    open_defects,
    fail_rate,
    reasons,
    evaluated_at: now,
    decision: "approved_with_override",
    override: {
      by: user.email,
      reason,
      at: now,
    },
  };
  await appendQualityGateHistory(entry);
  await sendQualityAlert({
    companySlug: slug,
    type: "override",
    severity: "warning",
    message: `Release ${release} aprovada com override`,
    metadata: { release, overrideBy: user.email, reason },
    timestamp: now,
  });
  return NextResponse.json({ ok: true });
}
