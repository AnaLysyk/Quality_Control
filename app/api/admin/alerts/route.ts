"use server";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getMockRole } from "@/lib/rbac/defects";
import { readAlertsStore } from "@/lib/qualityAlert";

export const revalidate = 0;

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const isAdmin = user?.isGlobalAdmin || mockRole === "admin";
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const alerts = await readAlertsStore();
  return NextResponse.json({ alerts }, { status: 200 });
}
