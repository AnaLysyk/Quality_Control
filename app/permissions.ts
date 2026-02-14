type RoleKey = "admin" | "company" | "user";
type ResourceKey = "defect" | "run";
type PermissionResourceMap = Record<ResourceKey, string[]>;

type PermissionCheckContext = {
  companyActive?: boolean;
};

// Permission matrix mirrors backend RBAC expectations and avoids client drift.
export const permissions: Record<RoleKey, PermissionResourceMap> = {
  admin: {
    defect: ["create", "edit", "delete", "linkRun"],
    run: ["create", "linkDefect"],
  },
  company: {
    defect: ["create", "edit", "linkRun"],
    run: ["create", "linkDefect"],
  },
  user: {
    defect: ["create", "linkRun"],
    run: ["create"],
  },
};

function normalizeToArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

export function can(
  userRole: string,
  resource: string | string[],
  action: string | string[],
  context: PermissionCheckContext = {},
): boolean {
  if (!Object.prototype.hasOwnProperty.call(permissions, userRole)) {
    return false;
  }

  if (context.companyActive === false && userRole !== "admin") {
    return false;
  }

  const roleKey = userRole as RoleKey;
  const candidateResources = normalizeToArray(resource);
  const candidateActions = normalizeToArray(action);

  return candidateResources.some((candidateResource) => {
    if (!(candidateResource in permissions[roleKey])) {
      return false;
    }
    const resourceKey = candidateResource as ResourceKey;
    const allowedActions = permissions[roleKey]?.[resourceKey];
    if (!Array.isArray(allowedActions) || allowedActions.length === 0) {
      return false;
    }
    return candidateActions.some((candidateAction) => allowedActions.includes(candidateAction));
  });
}
