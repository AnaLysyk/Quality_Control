import { NextResponse } from "next/server";
import { PERMISSION_MODULES } from "@/lib/permissionCatalog";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const revalidate = 0;

export async function GET(req: Request) {
  const guard = await requirePermission(req, "permissions", "view");
  if (!guard.ok) return guard.response;

  return NextResponse.json({ modules: PERMISSION_MODULES });
}
