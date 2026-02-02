import { JsonDataSource } from "./datasource/JsonDataSource";

export async function listUsers(clientId?: string | null) {
  return JsonDataSource.users.list(clientId);
}
