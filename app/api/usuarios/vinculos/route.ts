import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";
import { createNotificationsForUsers } from "@/lib/userNotificationsStore";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

function canManage(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  if (!user) return false;
  const role = String(user.permissionRole ?? user.role ?? user.companyRole ?? "