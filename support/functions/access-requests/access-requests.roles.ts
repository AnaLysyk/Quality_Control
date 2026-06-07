export const allowedAccessRequestRoles = [
  {
    label: "Líder TC",
    role: "leader_tc",
    email: "e2e-leader-tc@testingcompany.local",
    name: "E2E Líder TC",
  },
  {
    label: "Suporte Técnico",
    role: "technical_support",
    email: "e2e-suporte@testingcompany.local",
    name: "E2E Suporte Técnico",
  },
] as const;

export const deniedAccessRequestRoles = [
  {
    label: "Usuário Testing Company",
    role: "testing_company_user",
    email: "e2e-user-tc@testingcompany.local",
    name: "E2E Usuário TC",
  },
  {
    label: "Usuário da empresa",
    role: "company_user",
    email: "e2e-company-user@empresa.local",
    name: "E2E Usuário Empresa",
  },
  {
    label: "Empresa",
    role: "empresa",
    email: "e2e-empresa@empresa.local",
    name: "E2E Empresa",
  },
] as const;

export const accessRequestsRoute = "/admin/access-requests";
export const removedAccessRequestsRoute = "/admin/requests";
