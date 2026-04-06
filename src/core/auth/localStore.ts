import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "crypto";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import {
  assertUserCanLinkToCompany,
  normalizeUserOrigin,
  normalizeUserScope,
  resolveAllowMultiCompanyLink,
} from "@/lib/companyUserScope";

export type LocalAuthUser = {
  id: string;
  full_name?: string | null;
  name: string;
  email: string;
  user?: string;
  avatar_key?: string | null;
  password_hash: string;
  globalRole?: "global_admin" | null;
  role?: string | null;
  status?: "active" | "blocked" | "invited";
  active?: boolean;
  is_global_admin?: boolean;
  avatar_url?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  default_company_slug?: string | null;
  created_by_company_id?: string | null;
  home_company_id?: string | null;
  user_origin?: "testing_company" | "client_company";
  user_scope?: "shared" | "company_only";
  allow_multi_company_link?: boolean;
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
  qase_project_codes?: string[] | null;
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

const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");
const DATA_DIR =
  process.env.LOCAL_AUTH_DATA_DIR ||
  (process.env.VERCEL === "1" ? path.join("/tmp", "qc-data") : DEFAULT_DATA_DIR);
const STORE_PATH = path.join(DATA_DIR, "local-auth-store.json");
const SAMPLE_PATH = path.join(DEFAULT_DATA_DIR, "local-auth-store.sample.json");
const STORE_KEY = "qc:local_auth_store:v1";
const USE_REDIS = process.env.LOCAL_AUTH_STORE === "redis" || isRedisConfigured();
const USE_MEMORY_STORE =
  process.env.LOCAL_AUTH_IN_MEMORY === "true" ||
  (!USE_REDIS && process.env.VERCEL === "1");
let warnedFsFailure = false;

function normalizeDatabaseUrl(value?: string | null) {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function hasSupportedDatabaseUrl(value?: string | null) {
  const normalized = normalizeDatabaseUrl(value);
  return (
    normalized.startsWith("postgresql://") ||
    normalized.startsWith("prisma://") ||
    normalized.startsWith("prisma+postgres://")
  );
}

function isRecoverablePrismaDatasourceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Error validating datasource `db`") ||
    message.includes("Environment variable not found: DATABASE_URL") ||
    message.includes("the URL must start with the protocol `prisma://` or `postgresql://`") ||
    message.includes("the URL must start with the protocol `prisma://` or `prisma+postgres://`")
  );
}

// ── PostgreSQL mode ──────────────────────────────────────────────────────────
// Prefer PostgreSQL whenever DATABASE_URL is configured, unless AUTH_STORE
// explicitly opts into a non-Postgres backend.
export const USE_POSTGRES = shouldUsePostgresPersistence();

if (typeof process !== "undefined") {
  const backend = USE_POSTGRES ? "PostgreSQL" : process.env.LOCAL_AUTH_STORE === "redis" ? "Redis" : "JSON/Memory";
  const databaseUrlStatus = process.env.DATABASE_URL
    ? hasSupportedDatabaseUrl(process.env.DATABASE_URL)
      ? "valid"
      : "invalid"
    : "unset";
  console.log(`[AUTH-STORE] Backend: ${backend} (AUTH_STORE=${process.env.AUTH_STORE ?? "<unset>"}, DATABASE_URL=${databaseUrlStatus})`);
}

let _pgStore: typeof import("./pgStore") | null = null;
async function pg() {
  if (!_pgStore) _pgStore = await import("./pgStore");
  return _pgStore;
}

type GlobalAuthStore = {
  __qcLocalAuthStore?: LocalAuthStore;
  __qcLocalAuthStoreInit?: boolean;
};

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function slugifyLoginSeed(value?: string | null) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return normalized || "usuario";
}

function duplicateEmailError() {
  const err = new Error("E-mail ja cadastrado") as Error & { code?: string };
  err.code = "DUPLICATE_EMAIL";
  return err;
}

function duplicateUserError() {
  const err = new Error("Usuario ja cadastrado") as Error & { code?: string };
  err.code = "DUPLICATE_USER";
  return err;
}

function buildUniqueLogin(
  users: Array<Pick<LocalAuthUser, "id" | "email" | "user">>,
  preferredLogin: string | null | undefined,
  fallbackSeed: string,
  excludeUserId?: string,
) {
  const taken = new Set(
    users
      .filter((user) => user.id !== excludeUserId)
      .map((user) => normalizeLogin(user.user ?? user.email ?? "")),
  );

  const normalizedPreferred = normalizeLogin(preferredLogin ?? "");
  if (normalizedPreferred) {
    if (taken.has(normalizedPreferred)) throw duplicateUserError();
    return normalizedPreferred;
  }

  const base = slugifyLoginSeed(fallbackSeed);
  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}.${counter}`)) {
    counter += 1;
  }
  return `${base}.${counter}`;
}

export async function suggestNextUniqueLogin(input: {
  seed: string;
  excludeUserId?: string;
  avoid?: string[] | null;
}) {
  if (USE_POSTGRES) return (await pg()).pgSuggestNextUniqueLogin(input);
  const store = await readLocalAuthStore();
  const base = slugifyLoginSeed(input.seed);
  const taken = new Set(
    store.users
      .filter((user) => user.id !== input.excludeUserId)
      .map((user) => normalizeLogin(user.user ?? user.email ?? "")),
  );
  const avoid = new Set(
    (input.avoid ?? [])
      .map((value) => normalizeLogin(value ?? ""))
      .filter(Boolean),
  );

  if (!taken.has(base) && !avoid.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}.${counter}`) || avoid.has(`${base}.${counter}`)) {
    counter += 1;
  }
  return `${base}.${counter}`;
}

function normalizeComparableFullName(value?: string | null) {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
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
  if (normalized === "it_dev" || normalized === "itdev" || normalized === "developer" || normalized === "dev") return "it_dev";
  if (normalized === "technical_support" || normalized === "tech_support" || normalized === "support_tech") {
    return "technical_support";
  }
  if (normalized === "leader_tc" || normalized === "tc_leader" || normalized === "lider_tc") {
    return "leader_tc";
  }
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
        created_by_company_id:
          typeof user.created_by_company_id === "string" && user.created_by_company_id.trim()
            ? user.created_by_company_id.trim()
            : null,
        home_company_id:
          typeof user.home_company_id === "string" && user.home_company_id.trim()
            ? user.home_company_id.trim()
            : null,
        user_origin: normalizeUserOrigin(user.user_origin),
        user_scope: normalizeUserScope(user.user_scope),
        allow_multi_company_link: resolveAllowMultiCompanyLink(
          user.allow_multi_company_link,
          user.user_scope,
        ),
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

async function readStoreFromRedis(): Promise<LocalAuthStore | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalAuthStore;
    if (!parsed || typeof parsed !== "object") return null;
    const normalized: LocalAuthStore = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
      links: Array.isArray(parsed.links) ? parsed.links : [],
    };
    normalized.memberships = normalizeMemberships(normalized);
    return normalized;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[localAuthStore] Redis read failed, falling back:", msg);
    return null;
  }
}

async function writeStoreToRedis(store: LocalAuthStore): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.set(STORE_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[localAuthStore] Redis write failed, falling back:", msg);
    return false;
  }
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
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgReadLocalAuthStore();
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em readLocalAuthStore: ${message}`);
      } else {
        throw error;
      }
    }
  }
  if (USE_REDIS) {
    const redisStore = await readStoreFromRedis();
    if (redisStore) return cloneStore(redisStore);
    const seeded = await readStoreFromDisk();
    const ok = await writeStoreToRedis(seeded);
    if (!ok) {
      setMemoryStore(seeded);
    }
    return cloneStore(seeded);
  }
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
  if (USE_POSTGRES) return; // PG mode: individual CRUD ops handle persistence
  const payload: LocalAuthStore = {
    users: store.users ?? [],
    companies: store.companies ?? [],
    memberships: store.memberships ?? normalizeMemberships(store),
    links: store.links ?? [],
  };
  if (USE_REDIS) {
    const ok = await writeStoreToRedis(payload);
    if (ok) return;
  }
  if (USE_MEMORY_STORE) {
    setMemoryStore(cloneStore(payload));
    return;
  }
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    if (!warnedFsFailure) {
      warnedFsFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[localAuthStore] Falha ao escrever arquivo, usando memoria:", msg);
    }
    setMemoryStore(cloneStore(payload));
  }
}

async function loadStoreForWrite(): Promise<LocalAuthStore> {
  const store = await readLocalAuthStore();
  if (!USE_MEMORY_STORE && !USE_REDIS) {
    const exists = await storeExists();
    if (!exists) {
      await writeLocalAuthStore(store);
    }
  }
  return store;
}

export async function listLocalUsers(): Promise<LocalAuthUser[]> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgListLocalUsers();
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em listLocalUsers: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const store = await readLocalAuthStore();
  return [...store.users];
}

export async function listLocalCompanies(): Promise<LocalAuthCompany[]> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgListLocalCompanies();
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em listLocalCompanies: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const store = await readLocalAuthStore();
  return [...store.companies].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function listLocalMemberships(): Promise<LocalAuthMembership[]> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgListLocalMemberships();
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em listLocalMemberships: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const store = await readLocalAuthStore();
  return [...(store.memberships ?? [])];
}

export async function listLocalLinks(): Promise<LocalAuthMembership[]> {
  return listLocalMemberships();
}

export async function findLocalUserByEmailOrId(identifier: string): Promise<LocalAuthUser | null> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgFindLocalUserByEmailOrId(identifier);
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em findLocalUserByEmailOrId: ${message}`);
      } else {
        throw error;
      }
    }
  }
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
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgGetLocalUserById(id);
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em getLocalUserById: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const store = await readLocalAuthStore();
  const user = store.users.find((item) => item.id === id);
  return user ? { ...user } : null;
}

export async function findLocalCompanyById(id: string): Promise<LocalAuthCompany | null> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgFindLocalCompanyById(id);
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em findLocalCompanyById: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const store = await readLocalAuthStore();
  const company = store.companies.find((item) => item.id === id);
  return company ? { ...company } : null;
}

export async function findLocalCompanyBySlug(slug: string): Promise<LocalAuthCompany | null> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgFindLocalCompanyBySlug(slug);
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em findLocalCompanyBySlug: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const normalized = normalizeSlug(slug);
  const store = await readLocalAuthStore();
  const company = store.companies.find((item) => normalizeSlug(item.slug ?? "") === normalized);
  return company ? { ...company } : null;
}

export async function listLocalLinksForUser(userId: string): Promise<LocalAuthMembership[]> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgListLocalLinksForUser(userId);
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em listLocalLinksForUser: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const store = await readLocalAuthStore();
  return (store.memberships ?? []).filter((m) => m.userId === userId).map((m) => ({ ...m }));
}

export async function listLocalLinksForCompany(companyId: string): Promise<LocalAuthMembership[]> {
  if (USE_POSTGRES) {
    try {
      return await (await pg()).pgListLocalLinksForCompany(companyId);
    } catch (error) {
      if (!USE_POSTGRES && isRecoverablePrismaDatasourceError(error)) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        console.warn(`[AUTH-STORE] Fallback para JSON/Memory em listLocalLinksForCompany: ${message}`);
      } else {
        throw error;
      }
    }
  }
  const store = await readLocalAuthStore();
  return (store.memberships ?? []).filter((m) => m.companyId === companyId).map((m) => ({ ...m }));
}

export async function createLocalUser(input: {
  full_name?: string | null;
  name: string;
  email: string;
  user?: string;
  avatar_key?: string | null;
  password_hash: string;
  role?: string | null;
  globalRole?: "global_admin" | null;
  status?: "active" | "blocked" | "invited";
  active?: boolean;
  is_global_admin?: boolean;
  avatar_url?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  default_company_slug?: string | null;
  created_by_company_id?: string | null;
  home_company_id?: string | null;
  user_origin?: "testing_company" | "client_company";
  user_scope?: "shared" | "company_only";
  allow_multi_company_link?: boolean;
}): Promise<LocalAuthUser> {
  if (USE_POSTGRES) return (await pg()).pgCreateLocalUser(input);
  const store = await loadStoreForWrite();
  const email = normalizeLogin(input.email);
  const fullName = (input.full_name ?? input.name ?? input.email ?? "").trim();
  const login = buildUniqueLogin(
    store.users,
    input.user,
    fullName || input.name || email.split("@")[0] || email,
  );
  const existingByEmail = store.users.find((user) => normalizeLogin(user.email) === email);
  if (existingByEmail) {
    throw duplicateEmailError();
  }
  const user: LocalAuthUser = {
    id: `usr_${randomUUID().slice(0, 8)}`,
    full_name: fullName || null,
    name: input.name.trim() || email,
    email,
    user: login || email,
    avatar_key: input.avatar_key ?? null,
    password_hash: input.password_hash,
    role: input.role ?? "user",
    globalRole: input.globalRole ?? null,
    status: input.status ?? "active",
    active: input.active ?? true,
    is_global_admin: input.is_global_admin ?? false,
    avatar_url: input.avatar_url ?? null,
    job_title: input.job_title ?? null,
    linkedin_url: input.linkedin_url ?? null,
    phone: input.phone ?? null,
    default_company_slug: input.default_company_slug ?? null,
    created_by_company_id: input.created_by_company_id ?? null,
    home_company_id: input.home_company_id ?? null,
    user_origin: normalizeUserOrigin(input.user_origin),
    user_scope: normalizeUserScope(input.user_scope),
    allow_multi_company_link: resolveAllowMultiCompanyLink(
      input.allow_multi_company_link,
      input.user_scope,
    ),
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
  if (USE_POSTGRES) return (await pg()).pgUpdateLocalUser(id, patch);
  const store = await loadStoreForWrite();
  const idx = store.users.findIndex((user) => user.id === id);
  if (idx === -1) return null;
  const current = store.users[idx];
  const nextEmail = patch.email ? normalizeLogin(patch.email) : current.email;
  const nextName = patch.name ? patch.name : current.name;
  const nextFullName =
    patch.full_name !== undefined
      ? (patch.full_name ?? "").trim() || nextName || nextEmail
      : (current.full_name ?? nextName ?? nextEmail);
  const nextLogin =
    typeof patch.user === "string"
      ? buildUniqueLogin(store.users, patch.user, nextFullName || nextName || nextEmail, id)
      : normalizeLogin(current.user ?? current.email);

  const duplicateEmail = store.users.find((user) => user.id !== id && normalizeLogin(user.email) === nextEmail);
  if (duplicateEmail) {
    throw duplicateEmailError();
  }

  const next: LocalAuthUser = {
    ...current,
    ...(patch.full_name !== undefined ? { full_name: nextFullName || null } : {}),
    ...(patch.name ? { name: nextName } : {}),
    ...(patch.email ? { email: nextEmail } : {}),
    ...(typeof patch.user === "string" ? { user: nextLogin } : {}),
    ...(patch.avatar_key !== undefined ? { avatar_key: patch.avatar_key ?? null } : {}),
    ...(typeof patch.role === "string" ? { role: patch.role } : {}),
    ...(patch.globalRole !== undefined ? { globalRole: patch.globalRole } : {}),
    ...(typeof patch.status === "string" ? { status: patch.status } : {}),
    ...(typeof patch.active === "boolean" ? { active: patch.active } : {}),
    ...(typeof patch.is_global_admin === "boolean" ? { is_global_admin: patch.is_global_admin } : {}),
    ...(patch.avatar_url !== undefined ? { avatar_url: patch.avatar_url ?? null } : {}),
    ...(patch.job_title !== undefined ? { job_title: patch.job_title ?? null } : {}),
    ...(patch.linkedin_url !== undefined ? { linkedin_url: patch.linkedin_url ?? null } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone ?? null } : {}),
    ...(patch.default_company_slug !== undefined ? { default_company_slug: patch.default_company_slug ?? null } : {}),
    ...(patch.created_by_company_id !== undefined
      ? { created_by_company_id: patch.created_by_company_id ?? null }
      : {}),
    ...(patch.home_company_id !== undefined ? { home_company_id: patch.home_company_id ?? null } : {}),
    ...(patch.user_origin !== undefined ? { user_origin: normalizeUserOrigin(patch.user_origin) } : {}),
    ...(patch.user_scope !== undefined ? { user_scope: normalizeUserScope(patch.user_scope) } : {}),
    ...(patch.allow_multi_company_link !== undefined
      ? {
          allow_multi_company_link: resolveAllowMultiCompanyLink(
            patch.allow_multi_company_link,
            patch.user_scope ?? current.user_scope,
          ),
        }
      : {}),
    ...(patch.password_hash ? { password_hash: patch.password_hash } : {}),
  };
  store.users[idx] = next;
  await writeLocalAuthStore(store);
  return { ...next };
}

export async function createLocalCompany(input: Partial<LocalAuthCompany> & { name: string; slug?: string | null }) {
  if (USE_POSTGRES) return (await pg()).pgCreateLocalCompany(input);
  const store = await loadStoreForWrite();
  const normalizedName = normalizeComparableFullName(input.name ?? "");
  const normalizedTaxId =
    typeof input.tax_id === "string" ? input.tax_id.replace(/\D+/g, "") : "";
  const duplicateByName = store.companies.find(
    (company) => normalizeComparableFullName(company.name ?? company.company_name ?? "") === normalizedName,
  );
  if (normalizedName && duplicateByName) {
    const err = new Error("Empresa ja cadastrada com esse nome") as Error & { code?: string };
    err.code = "DUPLICATE_COMPANY_NAME";
    throw err;
  }
  const duplicateByTaxId =
    normalizedTaxId.length > 0
      ? store.companies.find((company) => {
          const companyTaxId = typeof company.tax_id === "string" ? company.tax_id.replace(/\D+/g, "") : "";
          return companyTaxId.length > 0 && companyTaxId === normalizedTaxId;
        })
      : null;
  if (duplicateByTaxId) {
    const err = new Error("CNPJ ja cadastrado para outra empresa") as Error & { code?: string };
    err.code = "DUPLICATE_COMPANY_TAX_ID";
    throw err;
  }
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
  if (USE_POSTGRES) return (await pg()).pgUpdateLocalCompany(id, patch);
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
  if (USE_POSTGRES) return (await pg()).pgDeleteLocalCompany(id);
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
  if (USE_POSTGRES) return (await pg()).pgUpsertLocalLink(input);
  const store = await loadStoreForWrite();
  const user = store.users.find((candidate) => candidate.id === input.userId) ?? null;
  assertUserCanLinkToCompany(user, input.companyId);
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
  if (USE_POSTGRES) return (await pg()).pgRemoveLocalLink(userId, companyId);
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
  const normalized = normalizeMembershipRole(companyRole ?? null);
  if (normalized === "it_dev") return "it_dev";
  if (isGlobalAdmin) return "admin";
  if (normalized === "company_admin") return "company";
  return "user";
}
