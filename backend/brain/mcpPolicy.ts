import type { AuthUser } from "@/backend/jwtAuth";

export type McpCapabilityProfile = {
  id: string;
  name: string;
  purpose: "exploration" | "debug" | "testing" | "data_extraction" | "visual" | "pdf";
  caps: string[];
  allowedRoles: string[];
  requiresConfirmation: boolean;
};

export type McpServerPolicy = {
  id: "brain" | "playwright" | "github" | "qase" | "database";
  name: string;
  scope: string[];
  requiredPermissions: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  timeoutMs: number;
  requiresConfirmation: boolean;
  logEnabled: boolean;
};

export const MCP_CAPABILITY_PROFILES: McpCapabilityProfile[] = [
  {
    id: "playwright-exploration",
    name: "Exploração simples",
    purpose: "exploration",
    caps: ["core", "testing"],
    allowedRoles: ["leader_tc", "technical_support", "testing_company_user", "company_user", "empresa"],
    requiresConfirmation: false,
  },
  {
    id: "playwright-login-session",
    name: "Login/Sessão",
    purpose: "testing",
    caps: ["core", "storage", "testing"],
    allowedRoles: ["leader_tc", "technical_support", "testing_company_user"],
    requiresConfirmation: false,
  },
  {
    id: "playwright-debug",
    name: "Debug",
    purpose: "debug",
    caps: ["core", "devtools", "network"],
    allowedRoles: ["leader_tc", "technical_support"],
    requiresConfirmation: true,
  },
  {
    id: "playwright-api-debug",
    name: "API/Debug",
    purpose: "data_extraction",
    caps: ["core", "network", "storage"],
    allowedRoles: ["leader_tc", "technical_support"],
    requiresConfirmation: true,
  },
  {
    id: "playwright-visual",
    name: "Visual/Canvas",
    purpose: "visual",
    caps: ["core", "vision"],
    allowedRoles: ["leader_tc", "technical_support"],
    requiresConfirmation: true,
  },
  {
    id: "playwright-pdf",
    name: "PDF",
    purpose: "pdf",
    caps: ["core", "pdf"],
    allowedRoles: ["leader_tc", "technical_support"],
    requiresConfirmation: true,
  },
];

export const MCP_SERVER_POLICIES: McpServerPolicy[] = [
  {
    id: "brain",
    name: "MCP Brain Server",
    scope: ["company", "project", "entity"],
    requiredPermissions: ["brain:read"],
    allowedActions: ["read_context", "read_graph", "query"],
    forbiddenActions: ["raw_dump_all_companies"],
    timeoutMs: 15000,
    requiresConfirmation: false,
    logEnabled: true,
  },
  {
    id: "playwright",
    name: "MCP Playwright Server",
    scope: ["project", "entity"],
    requiredPermissions: ["brain:read", "brain:write"],
    allowedActions: ["snapshot", "testing", "debug", "draft_generation"],
    forbiddenActions: ["unscoped_destructive_clicks"],
    timeoutMs: 30000,
    requiresConfirmation: true,
    logEnabled: true,
  },
  {
    id: "github",
    name: "MCP GitHub Server",
    scope: ["project"],
    requiredPermissions: ["brain:publish"],
    allowedActions: ["read_pr", "create_pr", "publish_with_confirmation"],
    forbiddenActions: ["force_push_main", "bypass_review"],
    timeoutMs: 30000,
    requiresConfirmation: true,
    logEnabled: true,
  },
  {
    id: "qase",
    name: "MCP Qase Server",
    scope: ["company", "project"],
    requiredPermissions: ["brain:read"],
    allowedActions: ["read_cases", "read_runs", "sync_metadata"],
    forbiddenActions: ["delete_case", "raw_token_export"],
    timeoutMs: 20000,
    requiresConfirmation: true,
    logEnabled: true,
  },
  {
    id: "database",
    name: "MCP Database Context Server",
    scope: ["company"],
    requiredPermissions: ["brain:read-sensitive"],
    allowedActions: ["schema_context", "safe_queries"],
    forbiddenActions: ["raw_table_dump", "write_without_guardrails"],
    timeoutMs: 10000,
    requiresConfirmation: true,
    logEnabled: true,
  },
];

export function resolveUserRoles(user: AuthUser) {
  const roles = [user.role, user.companyRole, user.permissionRole]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (user.isGlobalAdmin) roles.push("global_admin");
  return Array.from(new Set(roles));
}

export function resolveMcpPoliciesForUser(user: AuthUser) {
  const roles = resolveUserRoles(user);

  const servers = MCP_SERVER_POLICIES.filter((server) => {
    if (server.id === "github") {
      return roles.includes("leader_tc") || roles.includes("technical_support") || user.isGlobalAdmin === true;
    }
    if (server.id === "database") {
      return roles.includes("leader_tc") || roles.includes("technical_support") || user.isGlobalAdmin === true;
    }
    return true;
  });

  const profiles = MCP_CAPABILITY_PROFILES.filter((profile) =>
    profile.allowedRoles.some((role) => roles.includes(role)),
  );

  return { servers, profiles, roles };
}

