import {
  assignmentMatchesCompany,
  resolveCompanyProjectVisibility,
} from "@/lib/core/project/projectAccess";
import type { AccessAssignment } from "@/lib/core/session/accessAssignment";

function assignment(overrides: Partial<AccessAssignment> = {}): AccessAssignment {
  return {
    companyId: "A",
    companySlug: "empresa-a",
    companyName: "Empresa A",
    projectId: "A1",
    projectSlug: "projeto-a1",
    projectName: "Projeto A1",
    projectAccess: "selected_projects",
    role: "leader_tc",
    status: "active",
    source: "project_assignment",
    ...overrides,
  };
}

describe("projectAccess relacional", () => {
  it("exige que companyId e companySlug informados pertençam ao mesmo assignment", () => {
    const item = assignment();
    expect(assignmentMatchesCompany(item, { companyId: "A", companySlug: "empresa-a" })).toBe(true);
    expect(assignmentMatchesCompany(item, { companyId: "A", companySlug: "empresa-b" })).toBe(false);
    expect(assignmentMatchesCompany(item, { companyId: "B", companySlug: "empresa-a" })).toBe(false);
  });

  it("projectScope unrestricted retorna todos os projetos", () => {
    expect(
      resolveCompanyProjectVisibility(
        { projectScope: "unrestricted", assignments: [] },
        { companyId: "Z", companySlug: "empresa-z" },
      ),
    ).toEqual({ mode: "all", projectIds: [] });
  });

  it("all_company_projects retorna todos apenas para a empresa do vínculo", () => {
    const allA = assignment({ projectId: null, projectSlug: null, projectAccess: "all_company_projects", source: "membership" });
    expect(
      resolveCompanyProjectVisibility(
        { projectScope: "restricted", assignments: [allA] },
        { companyId: "A", companySlug: "empresa-a" },
      ),
    ).toEqual({ mode: "all", projectIds: [] });
    expect(
      resolveCompanyProjectVisibility(
        { projectScope: "restricted", assignments: [allA] },
        { companyId: "B", companySlug: "empresa-b" },
      ),
    ).toEqual({ mode: "none", projectIds: [] });
  });

  it("selected_projects retorna somente IDs da empresa selecionada, deduplicados", () => {
    const a1 = assignment();
    const a2 = assignment({ projectId: "A2", projectSlug: "projeto-a2" });
    const b1 = assignment({ companyId: "B", companySlug: "empresa-b", projectId: "B1", projectSlug: "projeto-b1" });
    expect(
      resolveCompanyProjectVisibility(
        { projectScope: "restricted", assignments: [b1, a2, a1, { ...a1 }] },
        { companyId: "A", companySlug: "empresa-a" },
      ),
    ).toEqual({ mode: "selected", projectIds: ["A1", "A2"] });
  });

  it("company_only não libera nenhum projeto", () => {
    const companyOnly = assignment({
      projectId: null,
      projectSlug: null,
      projectAccess: "company_only",
      source: "membership",
    });
    expect(
      resolveCompanyProjectVisibility(
        { projectScope: "none", assignments: [companyOnly] },
        { companyId: "A", companySlug: "empresa-a" },
      ),
    ).toEqual({ mode: "none", projectIds: [] });
  });

  it("assignment inativo e empresa sem vínculo não concedem projetos", () => {
    const inactive = { ...assignment(), status: "removed" as unknown as "active" };
    expect(
      resolveCompanyProjectVisibility(
        { projectScope: "restricted", assignments: [inactive] },
        { companyId: "A", companySlug: "empresa-a" },
      ),
    ).toEqual({ mode: "none", projectIds: [] });
  });
});
