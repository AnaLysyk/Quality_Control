/**
 * User service: wraps data source user methods for listing users.
 * Swap JsonDataSource for another implementation to change backend.
 */

import { JsonDataSource } from "./datasource/JsonDataSource";

/**
 * Lista usuários, opcionalmente filtrando por clientId.
 */
export async function listUsers(clientId?: string | null) {
  return JsonDataSource.users.list(clientId);
}
