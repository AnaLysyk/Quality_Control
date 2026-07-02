import "server-only";

import type { AccessContext } from "@/lib/auth/session";
import { listAdminUserItems, type AdminUserItem } from "@/lib/adminUsers";
import { listLocalCompanies } from "@/lib/auth/localStore";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

export type ChatContact = {
  id: string;
  name: string;
  email: string;
  user: string;
  avatar_url: string | null;
  permission_role: string | null;
  profile_kind: string | null;
  company_name: string | null;
  company_names: string[];
  active: boolean;
  status: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  origin_label: string | null;
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCompanyKey(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isPrivilegedAccess(
  access: Pick<AccessContext, "isGlobalAdmin" | "globalRole" | "role" | "companyRole">,
) {
  const role = normalizeLegacyRole(access.role);
  const companyRole = normalizeLegacyRole(access.companyRole);
  const globalRole = normalizeLegacyRole(access.globalRole);
  return (
    access.isGlobalAdmin === true ||
    role === SYSTEM_ROLES.LEADER_TC ||
    role === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    companyRole === SYSTEM_ROLES.LEADER_TC ||
    companyRole === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    globalRole === SYSTEM_ROLES.LEADER_TC ||
    globalRole === SYSTEM_ROLES.TECHNICAL_SUPPORT
  );
}

function mapContact(item: AdminUserItem): ChatContact {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    user: item.user ?? item.email,
    avatar_url: item.avatar_url ?? null,
    permission_role: item.permission_role ?? item.role ?? null,
    profile_kind: item.profile_kind ?? null,
    company_name: item.company_name ?? null,
    company_names: Array.isArray(item.company_names) ? item.company_names : [],
    active: item.active !== false,
    status: item.status ?? (item.active === false ? "inactive" : "active"),
    job_title: item.job_title ?? null,
    linkedin_url: item.linkedin_url ?? null,
    origin_label: item.origin_label ?? null,
  };
}

function collectContactCompanyIds(item: AdminUserItem) {
  return new Set(
    [
      item.client_id,
      ...(Array.isArray(item.companyIds) ? item.companyIds : []),
      ...(Array.isArray(item.company_ids) ? item.company_ids : []),
      ...(Array.isArray(item.companies) ? item.companies.map((company) => company.id) : []),
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value): value is string => value.length > 0),
  );
}

async function resolveVisibleCompanyIds(
  access: Pick<AccessContext, "companyId" | "companySlug" | "companySlugs">,
) {
  const companies = await listLocalCompanies();
  const visibleSlugs = new Set(
    [
      access.companySlug,
      ...(Array.isArray(access.companySlugs) ? access.companySlugs : []),
    ]
      .map((value) => normalizeCompanyKey(value))
      .filter((value): value is string => value.length > 0),
  );

  const visibleIds = companies
    .filter((company) => visibleSlugs.has(normalizeCompanyKey(company.slug)))
    .map((company) => company.id);

  if (visibleIds.length > 0) {
    return new Set(visibleIds);
  }

  return new Set(
    typeof access.companyId === "string" && access.companyId.trim().length > 0
      ? [access.companyId.trim()]
      : [],
  );
}

function itemIsVisibleForCompanies(item: AdminUserItem, allowedCompanyIds: Set<string>) {
  if (!allowedCompanyIds.size) return false;
  const contactCompanyIds = collectContactCompanyIds(item);
  for (const companyId of contactCompanyIds) {
    if (allowedCompanyIds.has(companyId)) return true;
  }
  return false;
}

function contactMatches(contact: ChatContact, search: string) {
  if (!search) return true;
  const haystack = normalizeSearch(
    [
      contact.name,
      contact.email,
      contact.user,
      contact.company_name,
      ...(contact.company_names ?? []),
      contact.permission_role ?? "",
      contact.profile_kind ?? "",
      contact.job_title ?? "",
      contact.origin_label ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(search);
}

export async function listChatContacts(
  access: Pick<
    AccessContext,
    "userId" | "companyId" | "companySlug" | "companySlugs" | "isGlobalAdmin" | "globalRole" | "role" | "companyRole"
  >,
  search = "",
) {
  const visibleItems = isPrivilegedAccess(access)
    ? await listAdminUserItems()
    : await (async () => {
        const allowedCompanyIds = await resolveVisibleCompanyIds(access);
        if (!allowedCompanyIds.size) return [];

        const items = await listAdminUserItems();
        return items.filter((item) => itemIsVisibleForCompanies(item, allowedCompanyIds));
      })();

  const normalizedSearch = normalizeSearch(search);
  return visibleItems
    .filter((item) => item.id !== access.userId)
    .map(mapContact)
    .filter((contact) => contactMatches(contact, normalizedSearch))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }));
}

