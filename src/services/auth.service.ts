/**
 * Auth service: wraps data source auth methods for login, me, and logout.
 * Swap JsonDataSource for another implementation to change backend.
 */
import { JsonDataSource } from "./datasource/JsonDataSource";
import type { AuthLoginInput } from "./datasource/DataSource";

/**
 * Realiza login com usuário e senha.
 */
export async function login(input: AuthLoginInput) {
  return JsonDataSource.auth.login(input);
}

/**
 * Obtém dados do usuário autenticado e suas empresas.
 */
export async function me() {
  return JsonDataSource.auth.me();
}

/**
 * Realiza logout do usuário autenticado.
 */
export async function logout() {
  return JsonDataSource.auth.logout();
}
