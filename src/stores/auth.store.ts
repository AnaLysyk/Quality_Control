/**
 * Auth store: wraps data source company methods for listing and creating companies.
 * Swap JsonDataSource for another implementation to change backend.
 */
import { JsonDataSource } from "@/services/datasource/JsonDataSource";
import type { CompanyCreateInput } from "@/services/datasource/DataSource";

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

/**
 * Hook para acessar o usuário autenticado e seu estado.
 */
export { useAuthUser } from "@/hooks/useAuthUser";
