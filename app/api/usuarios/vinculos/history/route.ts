import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>;
type ProfileKey = "leader_tc" | "qa_tc" | "business_user";

const AUDIT_ACTIONS = [
  "create",
  "remove",
  "assign_leader",
  "transfer_leader",
  "add_qa",
  "remove_qa",
  "update_business_user_projects",
  "deactivate_business_user",
] as const;
