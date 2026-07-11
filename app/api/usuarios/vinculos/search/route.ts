import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelationshipMode = "companies" | "leaders" | "qa_users" | "business_users";

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

