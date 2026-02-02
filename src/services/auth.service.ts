import { JsonDataSource } from "./datasource/JsonDataSource";
import type { AuthLoginInput } from "./datasource/DataSource";

export async function login(input: AuthLoginInput) {
  return JsonDataSource.auth.login(input);
}

export async function me() {
  return JsonDataSource.auth.me();
}

export async function logout() {
  return JsonDataSource.auth.logout();
}
