import type { AccessAssignment, ProjectScope } from "@/lib/auth/accessAssignment";

export type CompanyProjectVisibilityMode = "all" | "selected" | "none";

export type CompanyProjectVisibility = {
  mode: CompanyProjectVisibilityMode;
  projectIds: string[];
};

type ProjectAccessContext = {
  projectScope: ProjectScope;
  assignments: AccessAssignment[];
};

type CompanyIdentity = {
  companyId?: string | null;
  companySlug?: string | null;
};

function normalize(value?: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

function normalizeLower(value?: string | null) {
  return normalize(value)?.toLowerCase() ?? null;
}

/**
 * Confirma a empresa usando todos os identificadores presentes.
 * Quando id e slug são enviados, ambos precisam apontar para o mesmo vínculo.
 */
export function assignmentMatchesCompany(assignment: AccessAssignment, company: CompanyIdentity) {
  if (assignment.status !== "active") return false;

  const companyId = normalize(company.companyId);
  const companySlug = normalizeLower(company.companySlug);
  if (!companyId && !companySlug) return false;

  if (companyId && assignment.companyId !== companyId) return false;
  if (companySlug && assignment.companySlug.toLowerCase() !== companySlug) return false;
  return true;
}

/**
 * Traduz o contrato relacional para o filtro de leitura de projetos de uma
 * única empresa. Não usa allowedProjectIds legado e nunca combina empresas e
 * projetos de assignments diferentes.
 */
export function resolveCompanyProjectVisibility(
  access: ProjectAccessContext,
  company: CompanyIdentity,
): CompanyProjectVisibility {
  if (access.projectScope === "unrestricted") {
    return { mode: "all", projectIds: [] };
  }

  const companyAssignments = access.assignments.filter((assignment) =>
    assignmentMatchesCompany(assignment, company),
  );

  if (companyAssignments.some((assignment) => assignment.projectAccess === "all_company_projects")) {
    return { mode: "all", projectIds: [] };
  }

  const projectIds = Array.from(
    new Set(
      companyAssignments
        .filter(
          (assignment) =>
            assignment.projectAccess === "selected_projects" &&
            typeof assignment.projectId === "string" &&
            assignment.projectId.trim().length > 0,
        )
        .map((assignment) => assignment.projectId as string),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return projectIds.length > 0
    ? { mode: "selected", projectIds }
    : { mode: "none", projectIds: [] };
}
