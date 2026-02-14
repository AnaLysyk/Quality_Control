export * as authService from "./auth.service";
export * as companyService from "./company.service";
export * as userService from "./user.service";
export * from "./datasource/DataSource";
export { JsonDataSource } from "./datasource/JsonDataSource";
export { ApiDataSource } from "./datasource/ApiDataSource";

/**
 * Company service: wraps data source company methods for listing and creating companies.
 * Swap JsonDataSource for another implementation to change backend.
 */
import { JsonDataSource } from "./datasource/JsonDataSource";
import type { CompanyCreateInput } from "./datasource/DataSource";

/**
 * Lista todas as empresas disponíveis.
 */
export async function listCompanies() {
  return JsonDataSource.companies.list();
}

/**
 * Cria uma nova empresa com os dados fornecidos.
 */
export async function createCompany(input: CompanyCreateInput) {
  return JsonDataSource.companies.create(input);
}
