import "server-only";

import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
} from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

export type BuiltSessionPayload = {
  userId: string;
  email: string