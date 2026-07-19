import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import { resolveOperationalContext } from "@/backend/context/operationalContext";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { createQaseClient, QaseError } from "@/backend/qaseSdk";
import { validateJiraCloudCredentials } from "@/backend/jiraCloud";