import { listLocalCompanies } from "@/lib/auth/localStore";

type ClientEntry = {
  slug: string;
  name: string;
};

export async function listClients(): Promise<ClientEntry[]> {
  const companies = await listLocalCompanies();
  return companies.map((company) => ({ slug: company.slug, name: company.name ?? company.company_name ?? "Empresa" }));
}
