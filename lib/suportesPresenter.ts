import { listLocalUsers } from "@/lib/auth/localStore";
import type { SuporteRecord } from "@/lib/suportesStore";

export type SuporteWithAssignee = SuporteRecord & {
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

export async function attachAssigneeInfo(items: SuporteRecord[]): Promise<SuporteWithAssignee[]> {
  if (!Array.isArray(items) || items.length === 0) return [];
  const users = await listLocalUsers();
  const byId = new Map(users.map((user) => [user.id, user]));
  return items.map((item) => {
    const assignee = item.assignedToUserId ? byId.get(item.assignedToUserId) : null;
    return {
      ...item,
      assignedToName: assignee?.name ?? null,
      assignedToEmail: assignee?.email ?? null,
    };
  });
}

export async function attachAssigneeToSuporte(item: SuporteRecord | null) {
  if (!item) return null;
  const [withAssignee] = await attachAssigneeInfo([item]);
  return withAssignee ?? null;
}
