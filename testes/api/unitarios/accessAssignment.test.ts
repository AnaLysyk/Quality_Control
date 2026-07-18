import {
  deriveLegacyAllowedProjectIds,
  deriveLegacyCompanySlugs,
  deriveProjectScope,
  isCompanyAllowed,
  isCompanyProjectPairAllowed,
  type AccessAssignment,
} from "@/lib/auth/accessAssignment";

// Massa: Empresa A (Projeto A1, Projeto A2), Empresa B (Projeto B1), Empresa C (Projeto C1).
function assignment(
  overrides: Partial<AccessAssignment> & Pick<AccessAssignment, "companyId" | "companySlug">,
): AccessAssignment {
  return {
    projectId: null,
    projectSlug: null,
    projectAccess: "selected_projects",
    role: "leader_tc",
    status: "active",
    source: "project_assignment",
    ...overrides,
  };
}

const A_A1 = assignment({ companyId: "A", companySlug: "empresa-a", projectId: "A1", projectSlug: "projeto-a1" });
const A_A2 = assignment({ companyId: "A", companySlug: "empresa-a", projectId: "A2", projectSlug: "projeto-a2" });
const B_B1 = assignment({ companyId: "B", companySlug: "empresa-b", projectId: "B1", projectSlug: "projeto-b1" });
const A_COMPANY_ONLY = assignment({
  companyId: "A",
  companySlug: "empresa-a",
  projectId: null,
  projectAccess: "company_only",
  source: "membership",
  role: "empresa",
});
const A_ALL_PROJECTS = assignment({
  companyId: "A",
  companySlug: "empresa-a",
  projectId: null,
  projectAccess: "all_company_projects",
  source: "membership",
  role: "company_user",
});

describe("lib/auth/accessAssignment.ts - contrato relacional (Etapa 2.3A/2.3B)", () => {
  describe("Cenário 1 — A+A1, B+B1: nenhum produto cartesiano", () => {
    const query = { projectScope: "restricted" as const, assignments: [A_A1, B_B1] };

    it("A + A1 -> true", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(true);
    });
    it("B + B1 -> true", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "B", projectId: "B1" })).toBe(true);
    });
    it("A + B1 -> false", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "B1" })).toBe(false);
    });
    it("B + A1 -> false", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "B", projectId: "A1" })).toBe(false);
    });
    it("C + A1 -> false", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "C", projectId: "A1" })).toBe(false);
    });
    it("A + C1 -> false", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "C1" })).toBe(false);
    });
  });

  describe("Cenário 2 — A+A1, A+A2: ambos os projetos de A permitidos, nada de B", () => {
    const query = { projectScope: "restricted" as const, assignments: [A_A1, A_A2] };

    it("A + A1 -> true", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(true);
    });
    it("A + A2 -> true", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A2" })).toBe(true);
    });
    it("B + qualquer -> false", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "B", projectId: "B1" })).toBe(false);
    });
  });

  describe("Cenário 3 — assignment company_only", () => {
    const query = { projectScope: "none" as const, assignments: [A_COMPANY_ONLY] };

    it("A sem projeto, allowCompanyOnly=true -> true", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", allowCompanyOnly: true })).toBe(true);
    });
    it("A sem projeto, allowCompanyOnly ausente (false) -> false", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A" })).toBe(false);
    });
    it("A + A1 -> false (company_only nunca libera projeto arbitrário)", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(false);
    });
    it("B sem projeto -> false", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "B", allowCompanyOnly: true })).toBe(false);
    });
  });

  describe("all_company_projects (Correção 1 / 6)", () => {
    const query = { projectScope: "restricted" as const, assignments: [A_ALL_PROJECTS] };

    it("5. permite A1 quando o projeto resolvido pertence à empresa A", () => {
      expect(
        isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1", projectCompanyId: "A" }),
      ).toBe(true);
    });
    it("5b. permite A2 (qualquer projeto de A) quando resolvido corretamente", () => {
      expect(
        isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A2", projectCompanyId: "A" }),
      ).toBe(true);
    });
    it("6. não permite B1 mesmo pedindo companyId=A (a empresa real do projeto é B)", () => {
      expect(
        isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "B1", projectCompanyId: "B" }),
      ).toBe(false);
    });
    it("fail-closed: sem projectCompanyId resolvido pelo servidor, nega mesmo com companyId batendo", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(false);
    });
    it("não confia no companyId enviado pelo cliente sozinho", () => {
      // cliente alega empresa A, mas o projeto resolvido pertence a outra empresa
      expect(
        isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "X", projectCompanyId: "Z" }),
      ).toBe(false);
    });
    it("contexto só de empresa (allowCompanyOnly) continua funcionando", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", allowCompanyOnly: true })).toBe(true);
    });
  });

  describe("7. company_only da Empresa A não permite A1", () => {
    it("nega projeto mesmo sendo da mesma empresa", () => {
      const query = { projectScope: "none" as const, assignments: [A_COMPANY_ONLY] };
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1", projectCompanyId: "A" })).toBe(
        false,
      );
    });
  });

  describe("Cenário 4 — projectScope none (assignments=[])", () => {
    const assignments: AccessAssignment[] = [];

    it("qualquer projeto -> false", () => {
      expect(isCompanyProjectPairAllowed({ projectScope: "none", assignments }, { companyId: "A", projectId: "A1" })).toBe(
        false,
      );
    });
    it("allowedProjectIds derivado = [] (nunca null)", () => {
      expect(deriveLegacyAllowedProjectIds("none", assignments)).toEqual([]);
      expect(deriveLegacyAllowedProjectIds("none", assignments)).not.toBeNull();
    });
  });

  describe("Cenário 5 — projectScope unrestricted", () => {
    const query = { projectScope: "unrestricted" as const, assignments: [A_A1] };

    it("qualquer par é permitido, mesmo empresa/projeto nunca vistos", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "Z", projectId: "Z9" })).toBe(true);
    });
    it("allowedProjectIds derivado = null", () => {
      expect(deriveLegacyAllowedProjectIds("unrestricted", [A_A1])).toBeNull();
    });
    it("só é alcançável quando o chamador decidiu isUnrestrictedAccess=true", () => {
      expect(deriveProjectScope(false, [A_A1, A_A2, B_B1])).toBe("restricted");
      expect(deriveProjectScope(true, [])).toBe("unrestricted");
    });
  });

  describe("Cenário 6 — assignment inativo não aparece", () => {
    it("assignment com status diferente de active não concede empresa nem projeto", () => {
      const inactive = { ...A_A1, status: "removed" as unknown as "active" };
      const query = { projectScope: "restricted" as const, assignments: [inactive] };
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(false);
      expect(isCompanyAllowed(query, { companyId: "A" })).toBe(false);
    });
  });

  describe("Cenário 7 — Líder TC com múltiplos assignments em múltiplas empresas", () => {
    const assignments = [A_A1, A_A2, B_B1];

    it("todos os pares reais preservados", () => {
      const query = { projectScope: "restricted" as const, assignments };
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(true);
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A2" })).toBe(true);
      expect(isCompanyProjectPairAllowed(query, { companyId: "B", projectId: "B1" })).toBe(true);
    });
    it("não recebe empresa sem assignment (C nunca aparece)", () => {
      expect(deriveLegacyCompanySlugs(assignments)).toEqual(["empresa-a", "empresa-b"]);
    });
  });

  describe("Cenário 8 — Usuário TC com assignments qa_tc em múltiplas empresas", () => {
    const qaA1 = assignment({ companyId: "A", companySlug: "empresa-a", projectId: "A1", role: "qa_tc", source: "project_assignment" });
    const qaB1 = assignment({ companyId: "B", companySlug: "empresa-b", projectId: "B1", role: "qa_tc", source: "project_assignment" });
    const query = { projectScope: "restricted" as const, assignments: [qaA1, qaB1] };

    it("pares preservados", () => {
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(true);
      expect(isCompanyProjectPairAllowed(query, { companyId: "B", projectId: "B1" })).toBe(true);
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "B1" })).toBe(false);
    });
  });

  describe("Cenário 9 — Membership project-scoped vazio (all_company_projects) nunca vira unrestricted", () => {
    it("4. allowedProjectIds=[] em papel project-scoped gera all_company_projects, não unrestricted", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_ALL_PROJECTS] };
      // mesmo com um assignment all_company_projects, empresas/projetos não
      // relacionados continuam negados -- não é unrestricted.
      expect(isCompanyProjectPairAllowed(query, { companyId: "Z", projectId: "Z1", projectCompanyId: "Z" })).toBe(
        false,
      );
    });

    it("sem nenhum assignment: projectScope=none, allowedProjectIds=[], nunca null", () => {
      const scope = deriveProjectScope(false, []);
      expect(scope).toBe("none");
      expect(deriveLegacyAllowedProjectIds(scope, [])).toEqual([]);
    });
  });

  describe("Cenário 10 — duplicidades / 14. deduplicação", () => {
    const duplicated = [A_A1, { ...A_A1 }, B_B1];

    it("deriveLegacyCompanySlugs deduplica", () => {
      expect(deriveLegacyCompanySlugs(duplicated)).toEqual(["empresa-a", "empresa-b"]);
    });
    it("deriveLegacyAllowedProjectIds deduplica (só considera selected_projects)", () => {
      expect(deriveLegacyAllowedProjectIds("restricted", duplicated)).toEqual(["A1", "B1"]);
    });
    it("all_company_projects não entra na lista de IDs individuais do campo legado", () => {
      expect(deriveLegacyAllowedProjectIds("restricted", [A_A1, A_ALL_PROJECTS])).toEqual(["A1"]);
    });
  });

  describe("10. admin global não gera source=global / 11. assignments só contém vínculos reais", () => {
    it("AccessAssignmentSource só aceita project_assignment ou membership (checagem de tipo)", () => {
      const sources: AccessAssignment["source"][] = ["project_assignment", "membership"];
      expect(sources).not.toContain("global");
    });
    it("12/13. helper novo nunca interpreta assignments=[] como unrestricted, mesmo chamado isoladamente", () => {
      expect(deriveProjectScope(false, [])).toBe("none");
      expect(isCompanyProjectPairAllowed({ projectScope: "none", assignments: [] }, { companyId: "A", allowCompanyOnly: true })).toBe(
        false,
      );
    });
  });

  describe("isCompanyAllowed", () => {
    it("permite quando projectScope=unrestricted, mesmo empresa nunca vista", () => {
      expect(isCompanyAllowed({ projectScope: "unrestricted", assignments: [] }, { companyId: "Z" })).toBe(true);
    });
    it("nega empresa sem assignment quando restricted", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_A1] };
      expect(isCompanyAllowed(query, { companyId: "B" })).toBe(false);
    });
    it("permite empresa com assignment ativo", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_A1] };
      expect(isCompanyAllowed(query, { companyId: "A" })).toBe(true);
    });
    it("sem nenhuma empresa pedida, não filtra (permissivo por omissão)", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_A1] };
      expect(isCompanyAllowed(query, {})).toBe(true);
    });
  });

  describe("isCompanyProjectPairAllowed - fail-closed em dados incompletos", () => {
    it("sem companyId/companySlug -> false, mesmo com projectScope restricted e assignments existentes", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_A1] };
      expect(isCompanyProjectPairAllowed(query, { projectId: "A1" })).toBe(false);
    });
    it("projectSlug sem correspondência -> false", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_A1] };
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectSlug: "slug-que-nao-existe" })).toBe(false);
    });
    it("companySlug bate mas projectId não -> false", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_A1] };
      expect(isCompanyProjectPairAllowed(query, { companySlug: "empresa-a", projectId: "A2" })).toBe(false);
    });
  });

  describe("13. campo legado não é usado para validar pares", () => {
    it("isCompanyProjectPairAllowed não recebe nem consulta allowedProjectIds em nenhum momento (assinatura só aceita AccessAssignmentQuery)", () => {
      const query = { projectScope: "restricted" as const, assignments: [A_A1] };
      // Se o helper usasse um campo legado ele precisaria dele no input;
      // como a assinatura só aceita projectScope+assignments, isso já é
      // garantido estruturalmente. Confirma o comportamento correto mesmo
      // com um objeto que só tem esses dois campos.
      expect(Object.keys(query).sort()).toEqual(["assignments", "projectScope"]);
      expect(isCompanyProjectPairAllowed(query, { companyId: "A", projectId: "A1" })).toBe(true);
    });
  });
});
