import { listLocalCompanies } from "@/lib/auth/localStore";

export type ClientEntry = {
  slug: string;
  name: string;
  active: boolean;
};

function isCompanyActive(company: { active?: boolean; status?: string | null }): boolean {
  if (company.active === false) return false;
  const status = typeof company.status === "string" ? company.status.trim().toLowerCase() : null;
  if (!status) return true;
  return status === "active" || status === "ativa" || status === "ativo";
}

export async function listClients(): Promise<ClientEntry[]> {
  const companies = await listLocalCompanies();
  return companies
    .filter((company) => typeof company.slug === "string" && company.slug.length > 0 && isCompanyActive(company))
    .map((company) => ({
      slug: company.slug,
      name: company.name ?? company.company_name ?? "Empresa",
      active: true,
    }));
}
