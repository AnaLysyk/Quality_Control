import type { PermissionMatrix } from "@/backend/permissionMatrix";
import type { AccessContext } from "./session";
import type { AccessAssignment } from "./accessAssignment";

export type CurrentUserPublicInput = {
  id: string;
  email: string;
  name?: string | null;
  full_name?: string | null;
  user?: string | null;
  phone?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
  active?: boolean | null;
  status?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  user_origin?: string | null;
  default_company_slug?: string | null;
};

export type CurrentUserCanonicalResponse = ReturnType<typeof buildCurrentUserResponse>;

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function clonePermissions(permissions: PermissionMatrix): PermissionMatrix {
  const output: PermissionMatrix = {};
  for (const moduleId of Object.keys(permissions).sort((left, right) => left.localeCompare(right))) {
    output[moduleId] = Array.from(new Set(permissions[moduleId] ?? [])).sort((left, right) =>
      left.localeCompare(right),
    );
  }
  return output;
}

function assignmentSortKey(assignment: AccessAssignment) {
  return [
    assignment.companySlug?.toLowerCase() ?? "",
    assignment.companyId,
    assignment.projectAccess,
    assignment.projectSlug?.toLowerCase() ?? "",
    assignment.projectId ?? "",
    String(assignment.role),
    assignment.source,
  ].join("\u0000");
}

function cloneAssignments(assignments: AccessAssignment[]): AccessAssignment[] {
  return assignments
    .map((assignment) => ({ ...assignment }))
    .sort((left, right) => assignmentSortKey(left).localeCompare(assignmentSortKey(right)));
}

export function buildCurrentUserResponse(input: {
  access: AccessContext;
  permissions: PermissionMatrix;
  permissionRole: string | null;
  user: CurrentUserPublicInput;
  companyLogoUrl?: string | null;
}) {
  const { access, user } = input;
  const fullName = normalizeString(user.full_name);
  const displayName = fullName ?? normalizeString(user.name) ?? user.email;
  const active = user.active !== false;
  const permissions = clonePermissions(input.permissions);
  const assignments = cloneAssignments(access.assignments ?? []);
  const companySlugs = [...(access.companySlugs ?? [])];
  const allowedProjectIds = access.allowedProjectIds === null ? null : [...(access.allowedProjectIds ?? [])];
  const capabilities = [...(access.capabilities ?? [])];

  const canonicalUser = {
    id: user.id,
    email: user.email,
    name: displayName,
    user: user.user ?? user.email,
    username: user.user ?? user.email,
    phone: user.phone ?? null,
    avatarKey: user.avatar_key ?? null,
    avatarUrl: user.avatar_url ?? null,
    active,
    status: active ? user.status ?? "active" : "inactive",
    jobTitle: user.job_title ?? null,
    job_title: user.job_title ?? null,
    linkedinUrl: user.linkedin_url ?? null,
    linkedin_url: user.linkedin_url ?? null,
    fullName,
    role: access.role ?? null,
    globalRole: access.globalRole ?? null,
    companyRole: access.companyRole ?? null,
    permissionRole: input.permissionRole,
    capabilities,
    userOrigin: user.user_origin ?? access.userOrigin ?? null,
    user_origin: user.user_origin ?? access.userOrigin ?? null,
    companyId: access.companyId ?? null,
    companySlug: access.companySlug ?? null,
    companySlugs,
    clientId: access.companyId ?? null,
    clientSlug: access.companySlug ?? null,
    defaultClientSlug: user.default_company_slug ?? access.companySlug ?? null,
    clientSlugs: [...companySlugs],
    isGlobalAdmin: access.isGlobalAdmin === true,
    companyLogoUrl: input.companyLogoUrl ?? null,
    permissions,
  };

  return {
    user: canonicalUser,
    permissions,
    access: {
      projectScope: access.projectScope,
      assignments,
      companyId: access.companyId ?? null,
      companySlug: access.companySlug ?? null,
      companySlugs: [...companySlugs],
      allowedProjectIds,
    },
  };
}
