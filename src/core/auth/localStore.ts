import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "crypto";

export type LocalAuthUser = {
  id: string;
  name: string;
  email: string;
  user?: string;
  password_hash: string;
  globalRole?: "global_admin" | null;
  role?: string | null;
  status?: "active" | "blocked" | "invited";
  active?: boolean;
  is_global_admin?: boolean;
  job_title?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  default_company_slug?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

export type LocalAuthCompany = {
  id: string;
  name: string;
  slug: string;
  status?: "active" | "inactive" | "archived";
  active?: boolean;
  company_name?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
};

export type LocalAuthMembership = {
  id: string;
  userId: string;
  companyId: string;
  role?: "company_admin" | "user" | "viewer" | string | null;
  capabilities?: string[];
  createdAt?: string | null;
};

export type LocalAuthLink = {
  user_id: string;
  company_id: string;
  role?: string | null;
  permissions?: string[];
  active?: boolean;
};

export type LocalAuthStore = {
  users: LocalAuthUser[];
  companies: LocalAuthCompany[];
  memberships?: LocalAuthMembership[];
  links?: LocalAuthLink[];
};

const STORE_PATH = path.join(process.cwd(), "data", "local-auth-store.json");
const SAMPLE_PATH = path.join(process.cwd(), "data", "local-auth-store.sample.json");
const USE_MEMORY_STORE = process.env.LOCAL_AUTH_IN_MEMORY === "true";

type GlobalAuthStore = {
  __qcLocalAuthStore?: LocalAuthStore;
  __qcLocalAuthStoreInit?: boolean;
};

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeMembershipRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  if (normalized === "company_admin" || normalized === "user" || normalized === "viewer") return normalized;
  if (normalized === "admin" || normalized === "client_admin" || normalized === "company") return "company_admin";
  if (normalized === "read_only") return "viewer";
  return "user";
}

function normalizeMemberships(store: LocalAuthStore) {
  const memberships: LocalAuthMembership[] = [];

  if (Array.isArray(store.memberships)) {
    for (const raw of store.memberships) {
      if (!raw || typeof raw !== "object") continue;
      const userId = String((raw as LocalAuthMembership).userId ?? "");
      const companyId = String((raw as LocalAuthMembership).companyId ?? "");
      if (!userId || !companyId) continue;
      memberships.push({
        id: (raw as LocalAuthMembership).id ?? `${userId}-${companyId}`,
        userId,
        companyId,
        role: normalizeMembershipRole((raw as LocalAuthMembership).role ?? null),
        capabilities: Array.isArray((raw as LocalAuthMembership).capabilities)
          ? (raw as LocalAuthMembership).capabilities
          : undefined,
        createdAt: (raw as LocalAuthMembership).createdAt ?? null,
      });
    }
  }

  if (Array.isArray(store.links)) {
    for (const link of store.links) {
      if (!link || typeof link !== "object") continue;
      const userId = (link as LocalAuthLink).user_id;
      const companyId = (link as LocalAuthLink).company_id;
      if (!userId || !companyId) continue;
      const exists = memberships.find((m) => m.userId === userId && m.companyId === companyId);
      if (exists) continue;
      memberships.push({
        id: `${userId}-${companyId}`,
        userId,
        companyId,
        role: normalizeMembershipRole((link as LocalAuthLink).role ?? null),
        capabilities: Array.isArray((link as LocalAuthLink).permissions)
          ? (link as LocalAuthLink).permissions
          : undefined,
        createdAt: null,
      });
    }
  }

  return memberships;
}

async function readJson(filePath: string): Promise<LocalAuthStore | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalAuthStore> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const users = Array.isArray(parsed.users) ? (parsed.users as LocalAuthUser[]) : [];
    const companies = Array.isArray(parsed.companies) ? (parsed.companies as LocalAuthCompany[]) : [];
    const normalizedUsers = users.map((user) => {
      const rawUser = typeof user.user === "string" ? user.user.trim() : "";
      const rawEmail = typeof user.email === "string" ? user.email.trim() : "";
      const fallback = rawUser || rawEmail || "";
      return {
        ...user,
        user: rawUser || fallback,
        email: rawEmail || fallback,
      } as LocalAuthUser;
    });
    const store: LocalAuthStore = {
      users: normalizedUsers,
      companies,
      memberships: Array.isArray(parsed.memberships) ? (parsed.memberships as LocalAuthMembership[]) : [],
      links: Array.isArray(parsed.links) ? (parsed.links as LocalAuthLink[]) : [],
    };
    return store;
  } catch {
    return null;
  }
}

function cloneStore(store: LocalAuthStore): LocalAuthStore {
  if (typeof structuredClone === "function") return structuredClone(store);
  return JSON.parse(JSON.stringify(store)) as LocalAuthStore;
}

function getMemoryStore(): { store: LocalAuthStore; initialized: boolean } {
  const globalStore = globalThis as GlobalAuthStore;
  return {
    store: globalStore.__qcLocalAuthStore ?? { users: [], companies: [], memberships: [], links: [] },
    initialized: globalStore.__qcLocalAuthStoreInit === true,
  };
}

function setMemoryStore(store: LocalAuthStore) {
  const globalStore = globalThis as GlobalAuthStore;
  globalStore.__qcLocalAuthStore = store;
  globalStore.__qcLocalAuthStoreInit = true;
}

async function readStoreFromDisk(): Promise<LocalAuthStore> {
  const store = (await readJson(STORE_PATH)) ?? (await readJson(SAMPLE_PATH));
  const normalized = store ?? { users: [], companies: [], memberships: [], links: [] };
  normalized.memberships = normalizeMemberships(normalized);
  return normalized;
}

async function storeExists() {
  try {
    await fs.access(STORE_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function readLocalAuthStore(): Promise<LocalAuthStore> {
  if (!USE_MEMORY_STORE) {
    return readStoreFromDisk();
  }
  const memory = getMemoryStore();
  if (!memory.initialized) {
    const seeded = await readStoreFromDisk();
    setMemoryStore(seeded);
    return cloneStore(seeded);
  }
  return cloneStore(memory.store);
}

export async function writeLocalAuthStore(store: LocalAuthStore): Promise<void> {
  const payload: LocalAuthStore = {
    users: store.users ?? [],
    companies: store.companies ?? [],
    memberships: store.memberships ?? normalizeMemberships(store),
    links: store.links ?? [],
  };
  if (USE_MEMORY_STORE) {
    setMemoryStore(cloneStore(payload));
    return;
  }
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function loadStoreForWrite(): Promise<LocalAuthStore> {
  const store = await readLocalAuthStore();
  if (!USE_MEMORY_STORE) {
    const exists = await storeExists();
    if (!exists) {
      await writeLocalAuthStore(store);
    }
  }
  return store;
}

export async function listLocalUsers(): Promise<LocalAuthUser[]> {
  const store = await readLocalAuthStore();
  return [...store.users];
}

export async function listLocalCompanies(): Promise<LocalAuthCompany[]> {
  const store = await readLocalAuthStore();
  return [...store.companies].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function listLocalMemberships(): Promise<LocalAuthMembership[]> {
  const store = await readLocalAuthStore();
  return [...(store.memberships ?? [])];
}

export async function listLocalLinks(): Promise<LocalAuthMembership[]> {
  return listLocalMemberships();
}

export async function findLocalUserByEmailOrId(identifier: string): Promise<LocalAuthUser | null> {
  const normalized = normalizeLogin(identifier);
  const store = await readLocalAuthStore();
  const byLogin = store.users.find((user) => normalizeLogin(user.user ?? user.email ?? "") === normalized);
  if (byLogin) return { ...byLogin };
  const byEmail = store.users.find((user) => normalizeLogin(user.email ?? "") === normalized);
  if (byEmail) return { ...byEmail };
  const byId = store.users.find((user) => user.id === identifier);
  return byId ? { ...byId } : null;
}

export async function getLocalUserById(id: string): Promise<LocalAuthUser | null> {
  const store = await readLocalAuthStore();
  const user = store.users.find((item) => item.id === id);
  return user ? { ...user } : null;
}

export async function findLocalCompanyById(id: string): Promise<LocalAuthCompany | null> {
  const store = await readLocalAuthStore();
  const company = store.companies.find((item) => item.id === id);
  return company ? { ...company } : null;
}

export async function findLocalCompanyBySlug(slug: string): Promise<LocalAuthCompany | null> {
  const normalized = normalizeSlug(slug);
  const store = await readLocalAuthStore();
  const company = store.companies.find((item) => normalizeSlug(item.slug ?? "") === normalized);
  return company ? { ...company } : null;
}

export async function listLocalLinksForUser(userId: string): Promise<LocalAuthMembership[]> {
  const store = await readLocalAuthStore();
  return (store.memberships ?? []).filter((m) => m.userId === userId).map((m) => ({ ...m }));
}

export async function listLocalLinksForCompany(companyId: string): Promise<LocalAuthMembership[]> {
  const store = await readLocalAuthStore();
  return (store.memberships ?? []).filter((m) => m.companyId === companyId).map((m) => ({ ...m }));
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  password_hash: string;
  role?: string | null;
  globalRole?: "global_admin" | null;
  status?: "active" | "blocked" | "invited";
  active?: boolean;
  is_global_admin?: boolean;
  job_title?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
}): Promise<LocalAuthUser> {
  const store = await loadStoreForWrite();
  const email = normalizeLogin(input.email);
  const existing = store.users.find((user) => normalizeLogin(user.email) === email);
  if (existing) {
    return { ...existing };
  }
  const user: LocalAuthUser = {
    id: `usr_${randomUUID().slice(0, 8)}`,
    name: input.name.trim() || email,
    email,
    user: email,
    password_hash: input.password_hash,
    role: input.role ?? "user",
    globalRole: input.globalRole ?? null,
    status: input.status ?? "active",
    active: input.active ?? true,
    is_global_admin: input.is_global_admin ?? false,
    job_title: input.job_title ?? null,
    linkedin_url: input.linkedin_url ?? null,
    avatar_url: input.avatar_url ?? null,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  await writeLocalAuthStore(store);
  return { ...user };
}

export async function updateLocalUser(
  id: string,
  patch: Partial<Omit<LocalAuthUser, "id" | "password_hash">> & { password_hash?: string | null },
): Promise<LocalAuthUser | null> {
  const store = await loadStoreForWrite();
  const idx = store.users.findIndex((user) => user.id === id);
  if (idx === -1) return null;
  const current = store.users[idx];
  const next: LocalAuthUser = {
    ...current,
    ...(patch.name ? { name: patch.name } : {}),
    ...(patch.email ? { email: normalizeLogin(patch.email), user: normalizeLogin(patch.email) } : {}),
    ...(typeof patch.role === "string" ? { role: patch.role } : {}),
    ...(typeof patch.globalRole === "string" ? { globalRole: patch.globalRole } : {}),
    ...(typeof patch.status === "string" ? { status: patch.status } : {}),
    ...(typeof patch.active === "boolean" ? { active: patch.active } : {}),
    ...(typeof patch.is_global_admin === "boolean" ? { is_global_admin: patch.is_global_admin } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone ?? null } : {}),
    ...(patch.job_title !== undefined ? { job_title: patch.job_title ?? null } : {}),
    ...(patch.linkedin_url !== undefined ? { linkedin_url: patch.linkedin_url ?? null } : {}),
    ...(patch.avatar_url !== undefined ? { avatar_url: patch.avatar_url ?? null } : {}),
    ...(patch.password_hash ? { password_hash: patch.password_hash } : {}),
  };
  store.users[idx] = next;
  await writeLocalAuthStore(store);
  return { ...next };
}

export async function createLocalCompany(input: Partial<LocalAuthCompany> & { name: string; slug?: string | null }) {
  const store = await loadStoreForWrite();
  const slug = normalizeSlug(input.slug ?? input.name);
  let finalSlug = slug || `empresa-${randomUUID().slice(0, 8)}`;
  if (store.companies.some((company) => normalizeSlug(company.slug ?? "") === finalSlug)) {
    finalSlug = `${finalSlug}-${randomUUID().slice(0, 4)}`;
  }
  const { name, ...rest } = input;
  const company: LocalAuthCompany = {
    id: input.id ?? `cmp_${randomUUID().slice(0, 8)}`,
    name: name.trim() || finalSlug,
    slug: finalSlug,
    company_name: input.company_name ?? name,
    active: input.active ?? true,
    status: input.status ?? "active",
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...rest,
  };
  store.companies.push(company);
  await writeLocalAuthStore(store);
  return { ...company };
}

export async function updateLocalCompany(id: string, patch: Partial<LocalAuthCompany>): Promise<LocalAuthCompany | null> {
  const store = await loadStoreForWrite();
  const idx = store.companies.findIndex((company) => company.id === id);
  if (idx === -1) return null;
  const current = store.companies[idx];
  const next: LocalAuthCompany = {
    ...current,
    ...patch,
  };
  if (typeof patch.name === "string") {
    next.name = patch.name.trim() || current.name;
    next.company_name = patch.company_name ?? next.name;
  }
  if (typeof patch.slug === "string") {
    next.slug = normalizeSlug(patch.slug) || current.slug;
  }
  store.companies[idx] = next;
  await writeLocalAuthStore(store);
  return { ...next };
}

export async function deleteLocalCompany(id: string): Promise<boolean> {
  const store = await loadStoreForWrite();
  const idx = store.companies.findIndex((company) => company.id === id);
  if (idx === -1) return false;
  store.companies.splice(idx, 1);
  store.memberships = (store.memberships ?? []).filter((link) => link.companyId !== id);
  await writeLocalAuthStore(store);
  return true;
}

export async function upsertLocalLink(input: {
  userId: string;
  companyId: string;
  role?: string | null;
  capabilities?: string[] | null;
}) {
  const store = await loadStoreForWrite();
  const memberships = store.memberships ?? [];
  const idx = memberships.findIndex(
    (link) => link.userId === input.userId && link.companyId === input.companyId,
  );
  const role = normalizeMembershipRole(input.role ?? "user");
  if (idx >= 0) {
    memberships[idx] = {
      ...memberships[idx],
      role,
      ...(input.capabilities ? { capabilities: input.capabilities } : {}),
    };
  } else {
    memberships.push({
      id: `mbr_${randomUUID().slice(0, 8)}`,
      userId: input.userId,
      companyId: input.companyId,
      role,
      capabilities: input.capabilities ?? undefined,
      createdAt: new Date().toISOString(),
    });
  }
  store.memberships = memberships;
  await writeLocalAuthStore(store);
  return role;
}

export async function removeLocalLink(userId: string, companyId: string) {
  const store = await loadStoreForWrite();
  const before = (store.memberships ?? []).length;
  store.memberships = (store.memberships ?? []).filter(
    (link) => !(link.userId === userId && link.companyId === companyId),
  );
  const changed = (store.memberships ?? []).length !== before;
  if (changed) {
    await writeLocalAuthStore(store);
  }
  return changed;
}

export async function resolveUserCompanies(userId: string) {
  const [links, companies] = await Promise.all([listLocalLinksForUser(userId), listLocalCompanies()]);
  const byId = new Map(companies.map((company) => [company.id, company]));
  return links
    .map((link) => ({
      link,
      company: byId.get(link.companyId) ?? null,
    }))
    .filter((item) => item.company);
}

export function normalizeLocalRole(role?: string | null) {
  return normalizeMembershipRole(role ?? null);
}

export function normalizeGlobalRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  if (normalized === "global_admin") return "global_admin";
  return null;
}

export function toLegacyRole(companyRole?: string | null, isGlobalAdmin?: boolean) {
  if (isGlobalAdmin) return "admin";
  const normalized = normalizeMembershipRole(companyRole ?? null);
  if (normalized === "company_admin") return "company";
  return "user";
}
