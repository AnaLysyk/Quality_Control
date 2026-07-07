import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/requirePermission";

export async function GET(req: Request) {
  const guard = await requirePermission(req, "documents", "view");
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    buckets: [{ name: "local-bucket", region: "local" }],
  });
}
