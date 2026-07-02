import type { LocalAuthUser } from "@/lib/auth/localStore";
import {
  findLocalCompanyBySlug,
  listLocalLinksForCompany,
  listLocalUsers,
} from "@/lib/auth/localStore";

export type ManualReleaseResponsibleOption = {
  userId: string;
  label: string;
  name: string;
  email: string | null;
};

export function resolveLocalUserDisplayName(
  user?: Pick<LocalAuthUser, "full_name" | "name" | "email" | "user"> | null,
  fallback?: string | null,
) {
  const fullName = typeof user?.full_name === "string" ? user.full_name.trim() : "";
  const name = typeof user?.name === "string" ? user.name.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  const login = typeof user?.user === "string" ? user.user.trim() : "";
  const fallbackValue = typeof fallback === "string" ? fallback.trim() : "";
  return fullName || name || fallbackValue || email || login || null;
}

function buildResponsibleOption(user: LocalAuthUser): ManualReleaseResponsibleOption {
  const name = resolveLocalUserDisplayName(user) ?? user.id;
  const email = typeof user.email === "string" && user.email.trim() ? user.email.trim().toLowerCase() : null;
  const label = email && name.toLowerCase() !== email ? `${name} · ${email}` : name;
  return {
    userId: user.id,
    label,
    name,
    email,
  };
}

function compareResponsibleOptions(
  left: ManualReleaseResponsibleOption,
  right: ManualReleaseResponsibleOption,
) {
  return left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" });
}

function buildExtraUserIdSet(extraUserIds: Array<string | null | undefined>) {
  return new Set(
    extraUserIds
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean),
  );
}

async function addCompanyResponsibleIds(
  allowedIds: Set<string>,
  companySlug?: string | null,
) {
  if (typeof companySlug !== "string" || !companySlug.trim()) return;

  const company = await findLocalCompanyBySlug(companySlug.trim());
  if (!company?.id) return;

  const links = await listLocalLinksForCompany(company.id);
  for (const link of links) {
    if (typeof link.userId === "string" && link.userId.trim()) {
      allowedIds.add(link.userId.trim());
    }
  }
}

function canListResponsibleUser(
  user: LocalAuthUser,
  userId: string,
  extraIds: Set<string>,
) {
  const isInactive = user.active === false || String(user.status ?? "").toLowerCase() === "blocked";
  return !isInactive || extraIds.has(userId);
}

export async function listManualReleaseResponsibleOptions(
  companySlug?: string | null,
  extraUserIds: Array<string | null | undefined> = [],
) {
  const extraIds = buildExtraUserIdSet(extraUserIds);
  const allowedIds = new Set(extraIds);

  await addCompanyResponsibleIds(allowedIds, companySlug);

  if (allowedIds.size === 0) return [];

  const users = await listLocalUsers();
  const usersById = new Map(users.map((user) => [user.id, user]));
  const options: ManualReleaseResponsibleOption[] = [];

  for (const userId of allowedIds) {
    const user = usersById.get(userId);
    if (!user) continue;
    if (!canListResponsibleUser(user, userId, extraIds)) continue;
    options.push(buildResponsibleOption(user));
  }

  return options.sort(compareResponsibleOptions);
}

