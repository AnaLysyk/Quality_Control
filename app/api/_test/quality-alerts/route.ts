import { NextResponse } from "next/server";
import { writeAlertsStore, type QualityAlert } from "@/lib/qualityAlert";

const IS_TEST_ENV =
  process.env.PLAYWRIGHT_MOCK === "true" ||
  process.env.NODE_ENV === "test" ||
  process.env.E2E_USE_JSON === "1" ||
  process.env.E2E_USE_JSON === "true";

function normalizeAlert(input: Record<string, unknown>): QualityAlert | null {
  const companySlug = typeof input.companySlug === "string" ? input.companySlug : null;
  const type = typeof input.type === "string" ? input.type : null;
  const severity = typeof input.severity === "string" ? input.severity : null;
  const message = typeof input.message === "string" ? input.message : null;
  if (!companySlug || !type || !severity || !message) return null;
  return {
    companySlug,
    type: type as QualityAlert["type"],
    severity: severity as QualityAlert["severity"],
    message,
    metadata: typeof input.metadata === "object" && input.metadata ? (input.metadata as Record<string, unknown>) : undefined,
    timestamp: typeof input.timestamp === "string" ? input.timestamp : new Date().toISOString(),
  };
}

export async function POST(req: Request) {
  if (!IS_TEST_ENV) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!body) {
    return NextResponse.json({ message: "JSON invalido" }, { status: 400 });
  }

  const payload = Array.isArray(body)
    ? body
    : Array.isArray((body as { items?: unknown }).items)
      ? ((body as { items?: unknown[] }).items ?? [])
      : [body];

  const alerts = payload
    .map((item) => normalizeAlert((item ?? {}) as Record<string, unknown>))
    .filter((item): item is QualityAlert => Boolean(item));

  await writeAlertsStore(alerts);
  return NextResponse.json({ ok: true, total: alerts.length });
}
