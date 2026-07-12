import type { AccessContext } from "@/lib/auth/session";
import type { AccessAssignment } from "@/lib/core/session/accessAssignment";

export type ResolvedOperationalProject = {
  id: string;
  slug: string | null;
  companyId: string;
  companySlug: string | null;
};

export type OperationalProjectResolution =
  | { kind: "resolved"; project: ResolvedOperationalProject }
