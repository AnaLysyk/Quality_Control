import "server-only";

import type { AuthUser } from "@/backend/jwtAuth";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { prisma } from "@/database/prismaClient";
import type { AssistantScreenContext } from "../types";
import { isEmpresaUser } from "../data";
import type { AssistantExecutor