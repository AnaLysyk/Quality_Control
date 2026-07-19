// Contrato relacional de acesso (Entrega 1 / Bloco 2, Etapa 2.3A).
//
// Substitui, para quem consumir estes tipos/helpers, os arrays achatados
// companySlugs[]/allowedProjectIds[] por pares empresa+projeto preservados.
// Arrays achatados perdem a relação exata: com Empresa A+Projeto A1 e
// Empresa B+Projeto B1, companySlugs=[A,B] e allowedProjectIds=[A1,B1]
// permitem inferir incorretamente A+B1 ou B+A1. Este módulo é puro (sem
// Request/NextResponse/Prisma) e ainda NÃO está conectado a
// operationalContext nem a nenhuma rota consumidora — só criado e testado
// nesta etapa.

export type AccessAssignmentRole =
  | "leader_tc"
  | "qa_tc"
  | "company_user"
  | "testing_company_user"
  | "empresa"
  | "technical_support"
  | string;

// "project_assignment" = ProjectTeamAssignment ativo (Líder TC/Usuário TC).
// "membership" = Membership/link (Empresa, usuário empresarial, company_user
// sem papel líder). Não existe fonte sintética: acesso global é representado
// só por projectScope="unrestricted", nunca por um assignment inventado.
export type AccessAssignmentSource = "project_assignment" | "membership";

// Modo de acesso a projeto dentro do assignment. Necessário porque
// projectId=null é ambíguo: pode significar "essa empresa não tem nenhum
// projeto liberado" (company_only) ou "essa empresa libera TODOS os
// projetos, ainda não enumerados aqui" (all_company_projects) — são
// permissões muito diferentes e precisam ser distinguíveis.
export type AssignmentProjectAccess = "company_only" | "selected_projects" | "all_company_projects";

export type AccessAssignment = {
  companyId: string;
  companySlug: string;
  companyName?: string | null;
  // Só preenchido quando projectAccess="selected_projects". null nos outros
  // dois modos.
  projectId: string | null;
  projectSlug: string | null;
  projectName?: string | null;
  projectAccess: AssignmentProjectAccess;
  role: AccessAssignmentRole;
  status: "active";
  source: AccessAssignmentSource;
};

export type ProjectScope = "unrestricted" | "restricted" | "none";

export type AccessAssignmentQuery = {
  projectScope: ProjectScope;
  assignments: AccessAssignment[];
};

export type CompanyProjectPairRequest = {
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  // Empresa REAL do projeto solicitado, resolvida pelo chamador no servidor
  // (nunca a empresa que o cliente alega). Obrigatório para validar um
  // assignment projectAccess="all_company_projects" — sem isso o pedido é
  // negado (fail-closed), porque não dá para confirmar que o projeto
  // pertence à empresa liberada só confiando no companyId enviado.
  projectCompanyId?: string | null;
  // Só quando true um pedido sem projeto pode ser aceito contra um
  // assignment de empresa (company_only) ou contra qualquer assignment
  // daquela empresa. Módulos que exigem projeto devem deixar false/omitir.
  allowCompanyOnly?: boolean;
};

function normalize(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeLower(value?: string | null): string | null {
  const trimmed = normalize(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

// unrestricted: só quando o chamador já determinou (fora deste helper, com
// base em admin global real / Administrador com regra de acesso global
// verdadeira) que o acesso é global — nunca inferido do conteúdo de
// assignments nem de role textual. Ausência de assignments é sempre
// fail-closed ("none"), nunca "unrestricted".
export function deriveProjectScope(isUnrestrictedAccess: boolean, assignments: AccessAssignment[]): ProjectScope {
  if (isUnrestrictedAccess) return "unrestricted";
  return assignments.some((assignment) => assignment.projectAccess !== "company_only") ? "restricted" : "none";
}

// Campo legado (companySlugs). Mantido só para compatibilidade durante a
// migração — lista distinta das empresas presentes nos assignments,
// incluindo vínculos só de empresa. Nunca introduz empresa sem assignment.
// Para acesso global (projectScope="unrestricted"), a sessão continua
// derivando companySlugs de allowedCompanies diretamente (não deste
// helper), já que assignments não carrega mais entradas sintéticas.
export function deriveLegacyCompanySlugs(assignments: AccessAssignment[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const assignment of assignments) {
    const slug = normalize(assignment.companySlug);
    if (!slug) continue;
    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(slug);
  }
  return result;
}

// Versão "correta" do campo legado allowedProjectIds, calculada a partir do
// contrato novo. NÃO é usada ainda para preencher o campo legado vivo em
// getAccessContext (ver Correção 5 da Etapa 2.3B): durante a transição, o
// campo legado continua com a semântica antiga (inclusive a ambiguidade de
// allowedProjectIds=[] em Membership project-scoped == "sem restrição"),
// para não quebrar consumidores que ainda não migraram. Esta função fica
// disponível/testada para quando operationalContext e as rotas migrarem
// para o contrato novo. Regra crítica: [] nunca vira null aqui.
// unrestricted -> null; restricted -> lista distinta de projectIds
// (só de assignments com projectAccess="selected_projects" — projetos de
// all_company_projects não têm IDs individuais enumerados aqui); none -> []
// (nunca null).
export function deriveLegacyAllowedProjectIds(projectScope: ProjectScope, assignments: AccessAssignment[]): string[] | null {
  if (projectScope === "unrestricted") return null;
  if (projectScope === "none") return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const assignment of assignments) {
    if (assignment.projectAccess !== "selected_projects" || !assignment.projectId) continue;
    if (seen.has(assignment.projectId)) continue;
    seen.add(assignment.projectId);
    result.push(assignment.projectId);
  }
  return result;
}

// Só valida empresa (sem projeto). Fail-closed: sem projectScope
// unrestricted e sem companyId/companySlug pedido, não filtra (o chamador
// não pediu nada específico) — mas nunca inventa acesso a uma empresa
// específica que não bate com nenhum assignment ativo.
export function isCompanyAllowed(
  access: AccessAssignmentQuery,
  requested: { companyId?: string | null; companySlug?: string | null },
): boolean {
  if (access.projectScope === "unrestricted") return true;

  const companyId = normalize(requested.companyId);
  const companySlug = normalizeLower(requested.companySlug);
  if (!companyId && !companySlug) return true;

  return access.assignments.some((assignment) => {
    if (assignment.status !== "active") return false;
    if (companyId && assignment.companyId === companyId) return true;
    if (companySlug && assignment.companySlug.toLowerCase() === companySlug) return true;
    return false;
  });
}

// Valida o par empresa+projeto preservando a relação exata (nunca produto
// cartesiano). Fail-closed em dados incompletos: sem companyId/companySlug
// pedido, nega (diferente de isCompanyAllowed, que é permissivo por
// omissão — este helper é usado para decidir acesso a um recurso concreto,
// então ausência de identificação de empresa nunca deve passar).
export function isCompanyProjectPairAllowed(
  access: AccessAssignmentQuery,
  requested: CompanyProjectPairRequest,
): boolean {
  if (access.projectScope === "unrestricted") return true;

  const companyId = normalize(requested.companyId);
  const companySlug = normalizeLower(requested.companySlug);
  const projectId = normalize(requested.projectId);
  const projectSlug = normalizeLower(requested.projectSlug);
  const projectCompanyId = normalize(requested.projectCompanyId);
  const allowCompanyOnly = requested.allowCompanyOnly === true;

  if (!companyId && !companySlug) return false;

  const wantsProject = Boolean(projectId || projectSlug);

  return access.assignments.some((assignment) => {
    if (assignment.status !== "active") return false;

    const companyMatches =
      (companyId !== null && assignment.companyId === companyId) ||
      (companySlug !== null && assignment.companySlug.toLowerCase() === companySlug);
    if (!companyMatches) return false;

    if (!wantsProject) {
      // Contexto só de empresa: só aceito quando o chamador opta
      // explicitamente (módulo não exige projeto). Vale para qualquer modo
      // de projectAccess -- mesmo um assignment restrito a projetos
      // específicos ainda representa vínculo real com a empresa.
      return allowCompanyOnly;
    }

    if (assignment.projectAccess === "company_only") {
      // Nunca libera projeto nenhum -- isso seria o produto cartesiano que
      // a etapa proíbe.
      return false;
    }

    if (assignment.projectAccess === "selected_projects") {
      if (assignment.projectId === null) return false;
      if (projectId && assignment.projectId !== projectId) return false;
      if (projectSlug && (assignment.projectSlug ?? "").toLowerCase() !== projectSlug) return false;
      return true;
    }

    // all_company_projects: só libera quando a empresa REAL do projeto
    // solicitado (resolvida pelo chamador no servidor) bate com a empresa
    // do assignment. Nunca confia só no companyId/companySlug que o
    // cliente mandou -- isso seria trivialmente falsificável.
    if (!projectCompanyId) return false;
    return projectCompanyId === assignment.companyId;
  });
}
