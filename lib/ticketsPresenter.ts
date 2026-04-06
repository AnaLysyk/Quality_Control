import "server-only";

import { listLocalUsers, listLocalCompanies } from "@/lib/auth/localStore";
import type { TicketRecord } from "@/lib/ticketsStore";

export type TicketWithAssignee = TicketRecord & {
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  createdByLogin?: string | null;
  createdByAvatarUrl?: string | null;
};

export async function attachAssigneeInfo(items: TicketRecord[]): Promise<TicketWithAssignee[]> {
  if (!Array.isArray(items) || items.length === 0) return [];
  const [users, companies] = await Promise.all([listLocalUsers(), listLocalCompanies()]);
  const byId = new Map(users.map((user) => [user.id, user]));
  const companiesById = new Map(companies.map((company) => [company.id, company]));
  return items.map((item) => {
    const assignee = item.assignedToUserId ? byId.get(item.assignedToUserId) : null;
    const creator = item.createdBy ? byId.get(item.createdBy) : null;
    // Prefer company logo when the creator is associated to a company (created_by_company_id or home_company_id)
    let creatorCompanyLogo: string | null = null;
    try {
      const companyId = (creator as any)?.created_by_company_id ?? (creator as any)?.home_company_id ?? null;
      if (companyId) {
        const found = companiesById.get(companyId) ?? null;
        creatorCompanyLogo = found && typeof (found as any).logo_url === "string" ? (found as any).logo_url : null;
      }
    } catch {
      creatorCompanyLogo = null;
    }

    return {
      ...item,
      createdByName: item.createdByName ?? creator?.name ?? null,
      createdByEmail: item.createdByEmail ?? creator?.email ?? null,
      assignedToName: assignee?.name ?? null,
      assignedToEmail: assignee?.email ?? null,
      createdByLogin: creator?.user ?? null,
      createdByAvatarUrl: creatorCompanyLogo ?? creator?.avatar_url ?? null,
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
