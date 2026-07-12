import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { assertUserCanLinkToCompany } from "@/lib/companyUserScope";
import { createNotificationsForUsers } from "@/lib/userNotificationsStore";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const runtime = "nodejs