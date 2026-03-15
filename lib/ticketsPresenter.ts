import "server-only";

import { listLocalUsers } from "@/lib/auth/localStore";
import type { TicketRecord } from "@/lib/ticketsStore";

export type TicketWithAssignee = TicketRecord & {
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  createdByLogin?: string | null;
  createdByAvatarUrl?: string | null;
};

export async function attachAssigneeInfo(items: TicketRecord[]): Promise<TicketWithAssignee[]> {
  if (!Array.isArray(items) || items.length === 0) return [];
  const users = await listLocalUsers();
  const byId = new Map(users.map((user) => [user.id, user]));
  return items.map((item) => {
    const assignee = item.assignedToUserId ? byId.get(item.assignedToUserId) : null;
    const creator = item.createdBy ? byId.get(item.createdBy) : null;
    return {
      ...item,
      createdByName: item.createdByName ?? creator?.name ?? null,
      createdByEmail: item.createdByEmail ?? creator?.email ?? null,
      assignedToName: assignee?.name ?? null,
      assignedToEmail: assignee?.email ?? null,
      createdByLogin: creator?.user ?? null,
      createdByAvatarUrl: creator?.avatar_url ?? null,
    };
  });
}

export async function attachAssigneeToTicket(item: TicketRecord | null) {
  if (!item) return null;
  const [withAssignee] = await attachAssigneeInfo([item]);
  return withAssignee ?? null;
}

// Backwards-compatible alias
export const attachAssigneeToSuporte = attachAssigneeToTicket;
