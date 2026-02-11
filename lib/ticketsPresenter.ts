import "server-only";

import { listLocalUsers } from "@/lib/auth/localStore";
import type { TicketRecord } from "@/lib/ticketsStore";

export type TicketWithAssignee = TicketRecord & {
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

export async function attachAssigneeInfo(items: TicketRecord[]): Promise<TicketWithAssignee[]> {
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

export async function attachAssigneeToTicket(item: TicketRecord | null) {
  if (!item) return null;
  const [withAssignee] = await attachAssigneeInfo([item]);
  return withAssignee ?? null;
}
