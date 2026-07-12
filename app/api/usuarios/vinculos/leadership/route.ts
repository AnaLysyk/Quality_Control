import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";
import { createNotificationsForUsers } from "@/lib/userNotificationsStore";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
