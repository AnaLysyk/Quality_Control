import type { AccessAssignment, ProjectScope } from "@/lib/core/session/accessAssignment";

export type CompanyProjectVisibilityMode = "all" | "selected" | "none";

export type CompanyProjectVisibility = {
  mode: CompanyProjectVisibilityMode;
  projectIds: string[];
};

type ProjectAccessContext = {
  projectScope: ProjectScope;
  assignments: AccessAssignment[]