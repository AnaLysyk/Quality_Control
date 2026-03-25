import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prismaClient";
import type {
  LocalAuthUser,
  LocalAuthCompany,
  LocalAuthMembership,
  LocalAuthStore,
} from "./localStore";

// ── Converters ────────────────────────────────────────────────────────────────

type PrismaUser = {
  id: string;
  name: string;
  full_name: string | null;
  email: string;
  user: string | null;
  password_hash: string;
  globalRole: string | null;
  role: string | null;
  status: string;
  active: boolean;
  is_global_admin: boolean;
  avatar_key: string | null;
  avatar_url: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  default_company_slug: string | null;
  createdAt: Date;
};

type PrismaCompany = {
  id: string;
  name: string;
  company_name: string | null;
  slug: string;
  status: string;
  active: boolean;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  docs_link: string | null;
  notes: string | null;
  cep: string | null;
  linkedin_url: string | null;
  qase_token: string | null;
  qase_project_codes?: string[] | null;
  qase_project_code: string | null;
  jira_base_url: string | null;
  jira_email: string | null;
  jira_api_token: string | null;
  integration_mode: string | null;
  // relations
  integrations?: { id: string; type: string; config: unknown | null; createdAt: Date }[] | null;
  short_description: string | null;
  internal_notes: string | null;
  createdAt: Date;
};

type PrismaMembership = {
  id: string;
  userId: string;
  companyId: string;
  role: string | null;
  capabilities: string[];
  createdAt: Date;
};

function toLocalUser(u: PrismaUser): LocalAuthUser {
  return {
    id: u.id,
    name: u.name,
    full_name: u.full_name,
    email: u.email,
    user: u.user ?? u.email,
    password_hash: u.password_hash,
    globalRole: u.globalRole === "global_admin" ? "global_admin" : null,
    role: (u.role as string) ?? "user",
    status: (u.status as LocalAuthUser["status"]) ?? "active",
    active: u.active,
    is_global_admin: u.is_global_admin,
    avatar_key: u.avatar_key,
    avatar_url: u.avatar_url,
    job_title: u.job_title,
    linkedin_url: u.linkedin_url,
    phone: u.phone,
    default_company_slug: u.default_company_slug,
    createdAt: u.createdAt.toISOString(),
  };
}

function toLocalCompany(c: PrismaCompany): LocalAuthCompany {
  return {
    id: c.id,
    name: c.name,
    company_name: c.company_name,
    slug: c.slug,
    status: (c.status as LocalAuthCompany["status"]) ?? "active",
    active: c.active,
    tax_id: c.tax_id,
    address: c.address,
    phone: c.phone,
    website: c.website,
    logo_url: c.logo_url,
    docs_link: c.docs_link,
    notes: c.notes,
    cep: c.cep,
    linkedin_url: c.linkedin_url,
    qase_token: c.qase_token ?? undefined,
    qase_project_code: c.qase_project_code,
    qase_project_codes: Array.isArray((c as any).qase_project_codes) && (c as any).qase_project_codes.length ? (c as any).qase_project_codes : undefined,
    jira_base_url: c.jira_base_url,
    jira_email: c.jira_email,
    jira_api_token: c.jira_api_token,
    integration_mode: c.integration_mode,
    integrations: Array.isArray(c.integrations)
      ? c.integrations.map((i) => ({ id: i.id, type: i.type, config: i.config ?? undefined, createdAt: i.createdAt.toISOString() }))
      : undefined,
    short_description: c.short_description,
    internal_notes: c.internal_notes,
    createdAt: c.createdAt.toISOString(),
  };
}

function toLocalMembership(m: PrismaMembership): LocalAuthMembership {
  return {
    id: m.id,
    userId: m.userId,
    companyId: m.companyId,
    role: (m.role as string) as LocalAuthMembership["role"],
    capabilities: m.capabilities,
    createdAt: m.createdAt.toISOString(),
  };
}

// keep identity here — database stores legacy labels now
function mapRoleEnumToLegacy(_r?: string | null): string {
  return (_r ?? "user");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const nl = (v: string) => v.trim().toLowerCase();

function pgNormalizeSlug(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pgNormalizeMembershipRole(role?: string | null): string {
  const n = (role ?? "").toLowerCase();
  // Map inputs to legacy role labels stored in DB
  if (n === "admin") return "admin";
  if (n === "it_dev" || n === "itdev" || n === "developer" || n === "dev") return "it_dev";
  if (n === "company_admin" || n === "client_admin" || n === "company") return "company_admin";
  if (n === "support" || n === "technical_support") return "technical_support";
  if (n === "leader_tc" || n === "lider_tc") return "leader_tc";
  if (n === "viewer" || n === "read_only") return "viewer";
  if (n === "user") return "user";
  return "user";
}

function pgDuplicateEmailError() {
  const err = new Error("E-mail ja cadastrado") as Error & { code?: string };
  err.code = "DUPLICATE_EMAIL";
  return err;
}

function pgDuplicateUserError() {
  const err = new Error("Usuario ja cadastrado") as Error & { code?: string };
  err.code = "DUPLICATE_USER";
  return err;
}

function isPrismaUniqueViolation(err: unknown, field?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; meta?: { target?: string[] } };
  if (e.code !== "P2002") return false;
  if (!field) return true;
  return Array.isArray(e.meta?.target) && e.meta!.target!.includes(field);
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function pgFindLocalUserByEmailOrId(identifier: string): Promise<LocalAuthUser | null> {
  const n = nl(identifier);
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: n }, { user: n }, { id: identifier }] },
  });
  return user ? toLocalUser(user) : null;
}

export async function pgGetLocalUserById(id: string): Promise<LocalAuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toLocalUser(user) : null;
}

export async function pgListLocalUsers(): Promise<LocalAuthUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map(toLocalUser);
}

export async function pgCreateLocalUser(input: {
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
}): Promise<LocalAuthUser> {
  const email = nl(input.email);
  const loginRaw = nl(input.user ?? "");
  const loginBase = loginRaw || email.split("@")[0] || "usuario";

  // Build a unique login, checking the DB
  let login = loginBase;
  let counter = 2;
  while (await prisma.user.findFirst({ where: { user: login } })) {
    if (loginRaw && login === loginRaw) throw pgDuplicateUserError();
    login = `${loginBase}.${counter++}`;
  }

  try {
    console.log(`[PG-STORE] Creating user: email=${email} login=${login}`);
    const user = await prisma.user.create({
      data: {
        name: input.name.trim() || email,
        full_name: ((input.full_name ?? input.name ?? "").trim()) || null,
        email,
        user: login,
        password_hash: input.password_hash,
        role: pgNormalizeMembershipRole(input.role ?? "user") as any,
        globalRole: input.globalRole ?? null,
        status: input.status ?? "active",
        active: input.active ?? true,
        is_global_admin: input.is_global_admin ?? false,
        avatar_key: input.avatar_key ?? null,
        avatar_url: input.avatar_url ?? null,
        job_title: input.job_title ?? null,
        linkedin_url: input.linkedin_url ?? null,
        phone: input.phone ?? null,
      },
    });
    console.log(`[PG-STORE] User created OK: id=${user.id} email=${user.email}`);
    return toLocalUser(user);
  } catch (err) {
    console.error(`[PG-STORE] Error creating user: ${err}`);
    if (isPrismaUniqueViolation(err, "email")) throw pgDuplicateEmailError();
    if (isPrismaUniqueViolation(err, "user")) throw pgDuplicateUserError();
    throw err;
  }
}

export async function pgUpdateLocalUser(
  id: string,
  patch: Partial<Omit<LocalAuthUser, "id" | "password_hash">> & { password_hash?: string | null },
): Promise<LocalAuthUser | null> {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return null;

  const nextEmail = patch.email ? nl(patch.email) : undefined;
  if (nextEmail && nextEmail !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email: nextEmail } });
    if (dup) throw pgDuplicateEmailError();
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.full_name !== undefined ? { full_name: patch.full_name ?? null } : {}),
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(typeof patch.user === "string" ? { user: nl(patch.user) || undefined } : {}),
        ...(typeof patch.role === "string" ? { role: patch.role as any } : {}),
        ...(patch.globalRole !== undefined ? { globalRole: patch.globalRole } : {}),
        ...(typeof patch.status === "string" ? { status: patch.status } : {}),
        ...(typeof patch.active === "boolean" ? { active: patch.active } : {}),
        ...(typeof patch.is_global_admin === "boolean" ? { is_global_admin: patch.is_global_admin } : {}),
        ...(patch.avatar_key !== undefined ? { avatar_key: patch.avatar_key ?? null } : {}),
        ...(patch.avatar_url !== undefined ? { avatar_url: patch.avatar_url ?? null } : {}),
        ...(patch.job_title !== undefined ? { job_title: patch.job_title ?? null } : {}),
        ...(patch.linkedin_url !== undefined ? { linkedin_url: patch.linkedin_url ?? null } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone ?? null } : {}),
        ...(patch.default_company_slug !== undefined
          ? { default_company_slug: patch.default_company_slug ?? null }
          : {}),
        ...(patch.password_hash ? { password_hash: patch.password_hash } : {}),
      },
    });
    return toLocalUser(user);
  } catch (err) {
    if (isPrismaUniqueViolation(err, "email")) throw pgDuplicateEmailError();
    if (isPrismaUniqueViolation(err, "user")) throw pgDuplicateUserError();
    throw err;
  }
}

// ── Company ───────────────────────────────────────────────────────────────────

export async function pgFindLocalCompanyById(id: string): Promise<LocalAuthCompany | null> {
  const c = await prisma.company.findUnique({ where: { id }, include: { integrations: true } });
  return c ? toLocalCompany(c) : null;
}

export async function pgFindLocalCompanyBySlug(slug: string): Promise<LocalAuthCompany | null> {
  const normalized = pgNormalizeSlug(slug);
  const c = await prisma.company.findUnique({ where: { slug: normalized }, include: { integrations: true } });
  return c ? toLocalCompany(c) : null;
}

export async function pgListLocalCompanies(): Promise<LocalAuthCompany[]> {
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, include: { integrations: true } });
  return companies.map(toLocalCompany);
}

export async function pgCreateLocalCompany(
  input: Partial<LocalAuthCompany> & { name: string; slug?: string | null },
): Promise<LocalAuthCompany> {
  const nameNorm = (input.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (nameNorm) {
    const dup = await prisma.company.findFirst({
      where: { name: { equals: input.name.trim(), mode: "insensitive" } },
    });
    if (dup) {
      const err = new Error("Empresa ja cadastrada com esse nome") as Error & { code?: string };
      err.code = "DUPLICATE_COMPANY_NAME";
      throw err;
    }
  }

  const slugBase = pgNormalizeSlug(input.slug ?? input.name ?? "");
  let finalSlug = slugBase || `empresa-${randomUUID().slice(0, 8)}`;
  if (await prisma.company.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${finalSlug}-${randomUUID().slice(0, 4)}`;
  }

  const company = await prisma.company.create({
    data: {
      ...(input.id ? { id: input.id as string } : {}),
      name: input.name.trim(),
      company_name: (input.company_name as string | null | undefined) ?? input.name.trim(),
      slug: finalSlug,
      status: input.status ?? "active",
      active: input.active ?? true,
      tax_id: (input.tax_id as string | null | undefined) ?? null,
      address: (input.address as string | null | undefined) ?? null,
      phone: (input.phone as string | null | undefined) ?? null,
      website: (input.website as string | null | undefined) ?? null,
      logo_url: (input.logo_url as string | null | undefined) ?? null,
      docs_link: (input.docs_link as string | null | undefined) ?? null,
      notes: (input.notes as string | null | undefined) ?? null,
      cep: (input.cep as string | null | undefined) ?? null,
      linkedin_url: (input.linkedin_url as string | null | undefined) ?? null,
      qase_project_code: (input.qase_project_code as string | null | undefined) ?? null,
      jira_base_url: (input.jira_base_url as string | null | undefined) ?? null,
      jira_email: (input.jira_email as string | null | undefined) ?? null,
      jira_api_token: (input.jira_api_token as string | null | undefined) ?? null,
      qase_token: (input.qase_token as string | null | undefined) ?? null,
      integration_mode: (input.integration_mode as string | null | undefined) ?? "none",
      qase_project_codes: (input.qase_project_codes as string[] | undefined) ?? [],
      qase_project_code: (input.qase_project_code as string | null | undefined) ?? (Array.isArray((input as any).qase_project_codes) && (input as any).qase_project_codes.length ? (input as any).qase_project_codes[0] : null),
      short_description: (input.short_description as string | null | undefined) ?? null,
      internal_notes: (input.internal_notes as string | null | undefined) ?? null,
    },
  });
  // If integrations provided, create them
  if (Array.isArray((input as any).integrations) && (input as any).integrations.length) {
    const items = (input as any).integrations
      .filter((it: any) => it && typeof it === "object")
      .map((it: any) => ({ companyId: company.id, type: it.type, config: it.config ?? {} }));
    for (const it of items) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await prisma.companyIntegration.create({ data: it });
      } catch (e) {
        console.warn("[PG-STORE] failed to create company integration", e);
      }
    }
  }
  // re-fetch with integrations
  const full = await prisma.company.findUnique({ where: { id: company.id }, include: { integrations: true } });
  return toLocalCompany(full as PrismaCompany);
  return toLocalCompany(company);
}

export async function pgUpdateLocalCompany(
  id: string,
  patch: Partial<LocalAuthCompany>,
): Promise<LocalAuthCompany | null> {
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) return null;

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(patch.name
        ? { name: patch.name.trim(), company_name: (patch.company_name as string | undefined) ?? patch.name.trim() }
        : {}),
      ...(typeof patch.slug === "string"
        ? { slug: pgNormalizeSlug(patch.slug) || existing.slug }
        : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(typeof patch.active === "boolean" ? { active: patch.active } : {}),
      ...(patch.tax_id !== undefined ? { tax_id: (patch.tax_id as string | null) ?? null } : {}),
      ...(patch.logo_url !== undefined ? { logo_url: (patch.logo_url as string | null) ?? null } : {}),
      ...(patch.docs_link !== undefined ? { docs_link: (patch.docs_link as string | null) ?? null } : {}),
      ...(patch.notes !== undefined ? { notes: (patch.notes as string | null) ?? null } : {}),
      ...(patch.website !== undefined ? { website: (patch.website as string | null) ?? null } : {}),
      ...(patch.address !== undefined ? { address: (patch.address as string | null) ?? null } : {}),
      ...(patch.phone !== undefined ? { phone: (patch.phone as string | null) ?? null } : {}),
      ...(patch.cep !== undefined ? { cep: (patch.cep as string | null) ?? null } : {}),
      ...(patch.linkedin_url !== undefined ? { linkedin_url: (patch.linkedin_url as string | null) ?? null } : {}),
      ...(patch.qase_project_code !== undefined
        ? { qase_project_code: (patch.qase_project_code as string | null) ?? null }
        : {}),
      ...(patch.qase_project_codes !== undefined
        ? { qase_project_codes: (patch.qase_project_codes as string[] | null) ?? [] }
        : {}),
      ...(patch.qase_token !== undefined ? { qase_token: (patch.qase_token as string | null) ?? null } : {}),
      ...(patch.jira_base_url !== undefined
        ? { jira_base_url: (patch.jira_base_url as string | null) ?? null }
        : {}),
      ...(patch.jira_email !== undefined ? { jira_email: (patch.jira_email as string | null) ?? null } : {}),
      ...(patch.jira_api_token !== undefined
        ? { jira_api_token: (patch.jira_api_token as string | null) ?? null }
        : {}),
      ...(patch.integration_mode !== undefined
        ? { integration_mode: (patch.integration_mode as string | null) ?? null }
        : {}),
      ...(patch.short_description !== undefined
        ? { short_description: (patch.short_description as string | null) ?? null }
        : {}),
      ...(patch.internal_notes !== undefined
        ? { internal_notes: (patch.internal_notes as string | null) ?? null }
        : {}),
    },
  });
  // handle integrations patch: replace existing integrations if provided
  if (Array.isArray((patch as any).integrations)) {
    try {
      await prisma.companyIntegration.deleteMany({ where: { companyId: id } });
    } catch (e) {
      console.warn("[PG-STORE] failed to delete old integrations", e);
    }
    const items = (patch as any).integrations
      .filter((it: any) => it && typeof it === "object")
      .map((it: any) => ({ companyId: id, type: it.type, config: it.config ?? {} }));
    for (const it of items) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await prisma.companyIntegration.create({ data: it });
      } catch (e) {
        console.warn("[PG-STORE] failed to create integration during update", e);
      }
    }
  }
  const full = await prisma.company.findUnique({ where: { id }, include: { integrations: true } });
  return full ? toLocalCompany(full as PrismaCompany) : null;
  return toLocalCompany(company);
}

export async function pgDeleteLocalCompany(id: string): Promise<boolean> {
  try {
    await prisma.company.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ── Membership ────────────────────────────────────────────────────────────────

export async function pgUpsertLocalLink(input: {
  userId: string;
  companyId: string;
  role?: string | null;
  capabilities?: string[] | null;
}): Promise<string> {
  const role = pgNormalizeMembershipRole(input.role ?? "user");
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: input.userId, companyId: input.companyId } },
    create: {
      userId: input.userId,
      companyId: input.companyId,
      role: role as any,
      capabilities: input.capabilities ?? [],
    },
    update: {
      role: role as any,
      ...(input.capabilities ? { capabilities: input.capabilities } : {}),
    },
  });
  // Return legacy role string for backwards compatibility
  return mapRoleEnumToLegacy(role);
}

export async function pgRemoveLocalLink(userId: string, companyId: string): Promise<boolean> {
  const result = await prisma.membership.deleteMany({ where: { userId, companyId } });
  return result.count > 0;
}

export async function pgListLocalLinksForUser(userId: string): Promise<LocalAuthMembership[]> {
  const memberships = await prisma.membership.findMany({ where: { userId } });
  return memberships.map(toLocalMembership);
}

export async function pgListLocalLinksForCompany(companyId: string): Promise<LocalAuthMembership[]> {
  const memberships = await prisma.membership.findMany({ where: { companyId } });
  return memberships.map(toLocalMembership);
}

export async function pgListLocalMemberships(): Promise<LocalAuthMembership[]> {
  const memberships = await prisma.membership.findMany();
  return memberships.map(toLocalMembership);
}

// ── Full store read (used by resolveUserCompanies etc.) ───────────────────────

export async function pgReadLocalAuthStore(): Promise<LocalAuthStore> {
  const [users, companies, memberships] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.membership.findMany(),
  ]);
  return {
    users: users.map(toLocalUser),
    companies: companies.map(toLocalCompany),
    memberships: memberships.map(toLocalMembership),
    links: [],
  };
}

export async function pgSuggestNextUniqueLogin(input: {
  seed: string;
  excludeUserId?: string;
  avoid?: string[] | null;
}): Promise<string> {
  const base = input.seed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, "") || "usuario";

  const avoid = new Set((input.avoid ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean));

  const check = async (candidate: string) => {
    if (avoid.has(candidate)) return false;
    const existing = await prisma.user.findFirst({
      where: { user: candidate, ...(input.excludeUserId ? { NOT: { id: input.excludeUserId } } : {}) },
    });
    return !existing;
  };

  if (await check(base)) return base;
  let counter = 2;
  while (!(await check(`${base}.${counter}`))) counter++;
  return `${base}.${counter}`;
}
