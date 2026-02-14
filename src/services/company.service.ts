import { JsonDataSource } from "@/services/datasource/JsonDataSource";
import type { CompanyCreateInput } from "@/services/datasource/DataSource";

export async function listCompanies() {
  return JsonDataSource.companies.list();
}

export async function createCompany(input: CompanyCreateInput) {
  return JsonDataSource.companies.create(input);
}
