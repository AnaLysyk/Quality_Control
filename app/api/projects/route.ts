import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { resolveOperationalContext } from "@/lib/context/operationalContext";
import { resolveCompanyProjectVisibility } from "@/lib/core/project/projectAccess";
import { z } from "zod";

export const