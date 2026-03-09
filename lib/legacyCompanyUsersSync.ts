import "server-only";

import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

import { hashPasswordSha256 } from "@/lib/passwordHash";
import {
  readLocalAuthStore,
  writeLocalAuthStore,
  type LocalAuthCompany,
  type LocalAuthMembership,
  type LocalAuthUser,
} from "@/lib/auth/localStore";

type LegacyCompanyUser = {
  id?: string;
  name?: string;
  email?: string;
  user?: string;
  role?: string;
  companyId?: string;
  createdAt?: string;
  deletedAt?: string;
};

type LegacySyncResult = {
  changed: boolean;
  companiesAdded: number;
  usersImported: number;
  membershipsLinked: number;
};

const LEGACY_COMPANIES_DIR = path.join(process.cwd(), "data", "companies");
const ROLE_WEIGHT: Record<string, number> = {
  viewer: 0,
  user: 1,
  company_admin: 2,
  it_dev: 3,
};

let lastSyncAt = 0;
let inFlightSync: Promise<LegacySyncResult> | null = null;

function normalizeLogin(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeSlug(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLegacyRole(input?: string | null) {
  const value = normalizeLogin(input);
  if (
    value === "empresa" ||
    value === "company" ||
    value === "company_admin" ||
    value === "client_admin" ||
    value === "admin"
  ) {
    return "company_admin";
  }
  if (value === "dev" || value === "it_dev" || value === "developer") {
    return "it_dev";
  }
  if (value === "viewer" || value === "client_viewer" || value === "read_only") {
    return "viewer";
  }
  return "user";
}

function makePlaceholderCompany(companyId: string, existingSlugs: Set<string>): LocalAuthCompany {
  const baseName = `Empresa ${companyId}`;
  let slug = normalizeSlug(`empresa-${companyId.replace(/^cmp_/, "")}`) || `empresa-${randomUUID().slice(0, 8)}`;
  while (existingSlugs.has(slug)) {
    slug = `${slug}-${randomUUID().slice(0, 4)}`;
  }
  existingSlugs.add(slug);
  return {
    id: companyId,
    name: baseName,
    company_name: baseName,
    slug,
    active: true,
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

async function listLegacyCompanyIds() {
  try {
    const entries = await fs.readdir(LEGACY_COMPANIES_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  } catch {
    return [] as string[];
  }
}

async function readLegacyCompanyUsers(companyId: string) {
  const filePath = path.join(LEGACY_COMPANIES_DIR, companyId, "users.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegacyCompanyUser[]) : [];
  } catch {
    return [] as LegacyCompanyUser[];
  }
}

function updateRoleIfStronger(
  membership: LocalAuthMembership,
  nextRole: string,
) {
  const currentWeight = ROLE_WEIGHT[normalizeLegacyRole(membership.role)] ?? ROLE_WEIGHT.user;
  const nextWeight = ROLE_WEIGHT[nextRole] ?? ROLE_WEIGHT.user;
  if (nextWeight > currentWeight) {
    membership.role = nextRole;
    return true;
  }
  return false;
}

async function syncLegacyCompanyUsersInternal(): Promise<LegacySyncResult> {
  const companyIds = await listLegacyCompanyIds();
  if (!companyIds.length) {
    return { changed: false, companiesAdded: 0, usersImported: 0, membershipsLinked: 0 };
  }

  const store = await readLocalAuthStore();
  const companies = [...(store.companies ?? [])];
  const users = [...(store.users ?? [])];
  const memberships = [...(store.memberships ?? [])];

  const companyById = new Map(companies.map((company) => [company.id, company]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const userByEmail = new Map(users.map((user) => [normalizeLogin(user.email), user]));
  const userByLogin = new Map(users.map((user) => [normalizeLogin(user.user ?? user.email), user]));
  const membershipByKey = new Map(memberships.map((membership) => [`${membership.userId}:${membership.companyId}`, membership]));
  const existingSlugs = new Set(companies.map((company) => normalizeSlug(company.slug ?? company.name ?? company.id)));

  let changed = false;
  let companiesAdded = 0;
  let usersImported = 0;
  let membershipsLinked = 0;

  for (const companyId of companyIds) {
    if (!companyById.has(companyId)) {
      const placeholder = makePlaceholderCompany(companyId, existingSlugs);
      companies.push(placeholder);
      companyById.set(companyId, placeholder);
      companiesAdded += 1;
      changed = true;
    }

    const legacyUsers = await readLegacyCompanyUsers(companyId);
    for (const entry of legacyUsers) {
      const email = normalizeLogin(entry.email);
      if (!email) continue;

      const login = normalizeLogin(entry.user || email.split("@")[0] || email);
      const role = normalizeLegacyRole(entry.role);
      const legacyId = typeof entry.id === "string" ? entry.id.trim() : "";

      let user =
        (legacyId ? userById.get(legacyId) : undefined) ??
        userByEmail.get(email) ??
        userByLogin.get(login) ??
        null;

      if (!user) {
        const nextId = legacyId && !userById.has(legacyId) ? legacyId : `usr_${randomUUID().slice(0, 8)}`;
        user = {
          id: nextId,
          name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : email,
          email,
          user: login || email,
          password_hash: hashPasswordSha256(`${companyId}:${email}:${randomUUID()}`),
          role: "user",
          globalRole: null,
          status: entry.deletedAt ? "blocked" : "active",
          active: !entry.deletedAt,
          is_global_admin: false,
          createdAt: entry.createdAt ?? new Date().toISOString(),
        };
        users.push(user);
        userById.set(user.id, user);
        userByEmail.set(email, user);
        userByLogin.set(normalizeLogin(user.user ?? user.email), user);
        usersImported += 1;
        changed = true;
      }

      const membershipKey = `${user.id}:${companyId}`;
      const currentMembership = membershipByKey.get(membershipKey);
      if (!currentMembership) {
        const membership: LocalAuthMembership = {
          id: `mbr_${randomUUID().slice(0, 8)}`,
          userId: user.id,
          companyId,
          role,
          createdAt: entry.createdAt ?? new Date().toISOString(),
        };
        memberships.push(membership);
        membershipByKey.set(membershipKey, membership);
        membershipsLinked += 1;
        changed = true;
      } else if (updateRoleIfStronger(currentMembership, role)) {
        changed = true;
      }
    }
  }

  if (!changed) {
    return { changed: false, companiesAdded: 0, usersImported: 0, membershipsLinked: 0 };
  }

  await writeLocalAuthStore({
    ...store,
    companies,
    users,
    memberships,
  });

  return { changed: true, companiesAdded, usersImported, membershipsLinked };
}

export async function syncLegacyCompanyUsersToLocalStore() {
  const now = Date.now();
  if (inFlightSync) return inFlightSync;
  if (now - lastSyncAt < 5000) {
    return { changed: false, companiesAdded: 0, usersImported: 0, membershipsLinked: 0 };
  }

  inFlightSync = syncLegacyCompanyUsersInternal()
    .finally(() => {
      lastSyncAt = Date.now();
      inFlightSync = null;
    });

  return inFlightSync;
}
