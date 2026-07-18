import type { AccessContext } from "@/lib/auth/session";

export type ResolvedOperationalProject = {
  id: string;
  slug: string | null;
  companyId: string;
  companySlug: string | null;
};

export type OperationalProjectResolution =
  | { kind: "none" }
  | { kind: "resolved"; project: ResolvedOperationalProject }
  | { kind: "not_found" };

function normalize(value?: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

function normalizeLower(value?: string | null) {
  return normalize(value)?.toLowerCase() ?? null;
}

function companyMatches(
  assignment: AccessContext["assignments"][number],
  companyId?: string | null,
  companySlug?: string | null,
) {
  const requestedId = normalize(companyId);
  const requestedSlug = normalizeLower(companySlug);
  if (!requestedId && !requestedSlug) return true;
  return (
    (requestedId !== null && assignment.companyId === requestedId) ||
    (requestedSlug !== null && assignment.companySlug.toLowerCase() === requestedSlug)
  );
}

export async function resolveOperationalProject(input: {
  access: AccessContext;
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
}): Promise<OperationalProjectResolution> {
  const projectId = normalize(input.projectId);
  const projectSlug = normalizeLower(input.projectSlug);
  if (!projectId && !projectSlug) return { kind: "none" };

  const selectedAssignment = input.access.assignments.find((assignment) => {
    if (assignment.status !== "active" || assignment.projectAccess !== "selected_projects") return false;
    if (!companyMatches(assignment, input.companyId, input.companySlug)) return false;
    if (projectId && assignment.projectId !== projectId) return false;
    if (projectSlug && (assignment.projectSlug ?? "").toLowerCase() !== projectSlug) return false;
    return true;
  });

  if (selectedAssignment?.projectId) {
    return {
      kind: "resolved",
      project: {
        id: selectedAssignment.projectId,
        slug: selectedAssignment.projectSlug,
        companyId: selectedAssignment.companyId,
        companySlug: selectedAssignment.companySlug,
      },
    };
  }

  const canResolveAnyCompanyProject =
    input.access.projectScope === "unrestricted" ||
    input.access.assignments.some(
      (assignment) =>
        assignment.status === "active" &&
        assignment.projectAccess === "all_company_projects" &&
        companyMatches(assignment, input.companyId, input.companySlug),
    );

  if (!canResolveAnyCompanyProject) return { kind: "not_found" };

  try {
    const { prisma } = await import("@/database/prismaClient");
    const requestedCompanyId = normalize(input.companyId);
    const requestedCompanySlug = normalize(input.companySlug);
    const projects = await prisma.project.findMany({
      where: {
        ...(projectId ? { id: projectId } : {}),
        ...(projectSlug ? { slug: projectSlug } : {}),
        ...(requestedCompanyId ? { companyId: requestedCompanyId } : {}),
        ...(requestedCompanySlug ? { company: { slug: requestedCompanySlug } } : {}),
        status: "active",
      },
      take: 2,
      select: {
        id: true,
        slug: true,
        companyId: true,
        company: { select: { slug: true } },
      },
    });

    // Slug sem empresa pode existir em mais de uma empresa. Nesse caso não
    // escolhemos arbitrariamente: a resolução falha de forma fechada.
    if (projects.length !== 1) return { kind: "not_found" };
    const project = projects[0];
    return {
      kind: "resolved",
      project: {
        id: project.id,
        slug: project.slug,
        companyId: project.companyId,
        companySlug: project.company?.slug ?? null,
      },
    };
  } catch {
    return { kind: "not_found" };
  }
}
