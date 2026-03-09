import { NextResponse } from "next/server";

import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { createLocalCompany, createLocalUser, findLocalCompanyById, listLocalCompanies, listLocalUsers, upsertLocalLink } from "@/lib/auth/localStore";
import {
  composeAccessRequestMessage,
  normalizeAccessType,
  parseAccessRequestMessage,
  type AccessType,
} from "@/lib/accessRequestMessage";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalDeveloperWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import {
  normalizeRequestProfileType,
  requestProfileTypeNeedsCompany,
  toInternalAccessType,
  type RequestProfileType,
} from "@/lib/requestRouting";
import { shouldUseJsonStore } from "@/lib/storeMode";

type AcceptBody = {
  comment?: string;
  admin_notes?: string;
  email?: string;
  name?: string;
  full_name?: string;
  user?: string;
  phone?: string;
  role?: string;
  company?: string;
  client_id?: string | null;
  access_type?: string;
  title?: string;
  description?: string;
};

type PreparedAcceptance = {
  message: string;
  generatedUsername: string;
};

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function slugifyUsernamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

function buildUniqueUsername(source: string, takenValues: string[], preferred?: string | null) {
  const preferredCandidate = normalizeLogin(preferred ?? "");
  const taken = new Set(
    takenValues
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item && item !== preferredCandidate),
  );

  if (preferredCandidate && !taken.has(preferredCandidate)) {
    return preferredCandidate;
  }

  const base = slugifyUsernamePart(source) || "usuario";
  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}${counter}`)) {
    counter += 1;
  }
  return `${base}${counter}`;
}

async function resolveTestingCompanyId() {
  const companies = await listLocalCompanies();
  const match =
    companies.find((company) => (company.slug ?? "").toLowerCase() === "testing-company") ??
    companies.find((company) => (company.name ?? "").trim().toLowerCase() === "testing company") ??
    companies.find((company) => (company.company_name ?? "").trim().toLowerCase() === "testing company") ??
    null;
  return match?.id ?? null;
}

async function prepareAcceptanceMessage(
  existingMessage: string,
  fallbackEmail: string,
  body: AcceptBody,
): Promise<PreparedAcceptance> {
  const parsed = parseAccessRequestMessage(existingMessage, fallbackEmail);
  const profileType =
    normalizeRequestProfileType(body.access_type) ??
    parsed.profileType ??
    "testing_company_user";
  const accessType = normalizeAccessType(body.access_type) ?? parsed.accessType ?? toInternalAccessType(profileType);

  if (!parsed.passwordHash) {
    const error = new Error("Solicitacao sem senha informada pelo solicitante") as Error & { code?: string };
    error.code = "MISSING_PASSWORD";
    throw error;
  }

  const fullName = (typeof body.full_name === "string" ? body.full_name.trim() : "") || parsed.fullName || parsed.name || fallbackEmail;
  const name = fullName;
  const email = (typeof body.email === "string" ? body.email.trim().toLowerCase() : "") || parsed.email || fallbackEmail;
  const phone = (typeof body.phone === "string" ? body.phone.trim() : "") || parsed.phone || "";
  const role = (typeof body.role === "string" ? body.role.trim() : "") || parsed.jobRole || "";
  const title = (typeof body.title === "string" ? body.title.trim() : "") || parsed.title || "";
  const description = (typeof body.description === "string" ? body.description.trim() : "") || parsed.description || "";
  const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes.trim() : "";

  let clientId =
    (typeof body.client_id === "string" && body.client_id.trim() ? body.client_id.trim() : null) ??
    parsed.clientId;
  let company =
    (typeof body.company === "string" ? body.company.trim() : "") ||
    parsed.company ||
    "(nao informado)";

  if (requestProfileTypeNeedsCompany(profileType) && !clientId) {
    clientId = await resolveTestingCompanyId();
  }

  if (requestProfileTypeNeedsCompany(profileType)) {
    if (!clientId) {
      const error = new Error("Empresa obrigatoria para Usuario") as Error & { code?: string };
      error.code = "MISSING_COMPANY";
      throw error;
    }
    const selectedCompany = await findLocalCompanyById(clientId);
    if (!selectedCompany) {
      const error = new Error("Empresa selecionada nao encontrada") as Error & { code?: string };
      error.code = "MISSING_COMPANY";
      throw error;
    }
    company = (selectedCompany.name ?? selectedCompany.company_name ?? "").trim() || company;
  } else if (profileType === "company_user") {
    company = parsed.companyProfile?.companyName?.trim() || company || "(nao informado)";
  } else {
    clientId = null;
    company = "(nao informado)";
  }

  const users = await listLocalUsers();
  const takenValues = users.flatMap((user) => [user.user, user.email].filter((value): value is string => Boolean(value)));
  const generatedUsername = buildUniqueUsername(
    fullName || name || email.split("@")[0] || email,
    takenValues,
    typeof body.user === "string" ? body.user : parsed.username,
  );

  const message = composeAccessRequestMessage({
    email,
    name,
    fullName,
    username: generatedUsername,
    phone,
    passwordHash: parsed.passwordHash,
    role,
    company,
    clientId,
    accessType,
    profileType,
    title,
    description,
    notes: parsed.notes,
    companyProfile: parsed.companyProfile,
    adminNotes,
  });

  return { message, generatedUsername };
}

async function resolveRequestedUser(message: string, fallbackEmail: string) {
  const parsed = parseAccessRequestMessage(message, fallbackEmail);
  const accessType = parsed.accessType;
  const profileType = parsed.profileType;
  const email = parsed.email || fallbackEmail;
  const login = normalizeLogin(parsed.username ?? email.split("@")[0] ?? email);
  const fullName = (parsed.fullName ?? parsed.name ?? email).trim();
  const displayName = fullName || email;
  let companyId = parsed.clientId;

  if (requestProfileTypeNeedsCompany(profileType) && !companyId) {
    companyId = await resolveTestingCompanyId();
  }

  if (!parsed.passwordHash) {
    const error = new Error("Solicitacao sem senha informada pelo solicitante") as Error & { code?: string };
    error.code = "MISSING_PASSWORD";
    throw error;
  }

  if (accessType === "global") {
    return {
      email,
      login,
      fullName,
      displayName,
      role: "it_dev" as const,
      globalRole: "global_admin" as const,
      isGlobalAdmin: true,
      linkCompanyId: null,
      membershipRole: null,
      passwordHash: parsed.passwordHash,
    };
  }

  if (accessType === "admin") {
    return {
      email,
      login,
      fullName,
      displayName,
      role: "user" as const,
      globalRole: "global_admin" as const,
      isGlobalAdmin: true,
      linkCompanyId: null,
      membershipRole: null,
      passwordHash: parsed.passwordHash,
    };
  }

  if (accessType === "company") {
    const companyName = parsed.companyProfile?.companyName?.trim() || parsed.company?.trim() || "";
    if (!companyName) {
      const error = new Error("Nome da empresa obrigatorio") as Error & { code?: string };
      error.code = "MISSING_COMPANY_NAME";
      throw error;
    }
    const createdCompany = await createLocalCompany({
      name: companyName,
      company_name: companyName,
      tax_id: parsed.companyProfile?.companyTaxId || null,
      cep: parsed.companyProfile?.companyZip || null,
      address: parsed.companyProfile?.companyAddress || null,
      phone: parsed.companyProfile?.companyPhone || parsed.phone || null,
      website: parsed.companyProfile?.companyWebsite || null,
      linkedin_url: parsed.companyProfile?.companyLinkedin || null,
      short_description: parsed.companyProfile?.companyDescription || null,
      notes: parsed.companyProfile?.companyNotes || parsed.notes || null,
      description: parsed.companyProfile?.companyDescription || null,
      active: true,
      status: "active",
      created_at: new Date().toISOString(),
    });
    return {
      email,
      login,
      fullName,
      displayName,
      role: "company_admin" as const,
      globalRole: null,
      isGlobalAdmin: false,
      linkCompanyId: createdCompany.id,
      membershipRole: "company_admin" as const,
      passwordHash: parsed.passwordHash,
    };
  }

  if (!companyId) {
    const error = new Error("Empresa obrigatoria para Usuario") as Error & { code?: string };
    error.code = "MISSING_COMPANY";
    throw error;
  }

  return {
    email,
    login,
    fullName,
    displayName,
    role: "user" as const,
    globalRole: null,
    isGlobalAdmin: false,
    linkCompanyId: companyId,
    membershipRole: "user" as const,
    passwordHash: parsed.passwordHash,
  };
}

async function ensureLocalUser(message: string, fallbackEmail: string) {
  const resolved = await resolveRequestedUser(message, fallbackEmail);
  const created = await createLocalUser({
    full_name: resolved.fullName,
    name: resolved.displayName,
    email: resolved.email,
    user: resolved.login,
    password_hash: resolved.passwordHash,
    role: resolved.role,
    globalRole: resolved.globalRole,
    is_global_admin: resolved.isGlobalAdmin,
    active: true,
  });

  if (resolved.linkCompanyId && resolved.membershipRole) {
    await upsertLocalLink({
      userId: created.id,
      companyId: resolved.linkCompanyId,
      role: resolved.membershipRole,
      capabilities: null,
    });
  }

  return created.id;
}

function toCreateUserError(error: unknown) {
  const code = error && typeof error === "object" ? (error as { code?: string }).code : null;
  if (code === "MISSING_COMPANY") return { status: 400, error: "Empresa obrigatoria para este perfil" };
  if (code === "MISSING_COMPANY_NAME") return { status: 400, error: "Nome da empresa obrigatorio para este perfil" };
  if (code === "MISSING_PASSWORD") return { status: 400, error: "A solicitacao precisa ter uma senha definida para ser aprovada" };
  if (code === "DUPLICATE_EMAIL") return { status: 409, error: "E-mail ja cadastrado" };
  if (code === "DUPLICATE_USER") return { status: 409, error: "Usuario ja cadastrado" };
  if (code === "DUPLICATE_COMPANY_NAME") return { status: 409, error: "Empresa ja cadastrada com esse nome" };
  if (code === "DUPLICATE_COMPANY_TAX_ID") return { status: 409, error: "CNPJ ja cadastrado para outra empresa" };
  return null;
}

function buildApprovalComment(generatedUsername: string, adminComment: string) {
  const lines = [
    "Solicitacao aceita.",
    `Seu usuario e ${generatedUsername}.`,
    "Use a senha que voce criou ao solicitar acesso para entrar na plataforma.",
  ];
  if (adminComment) {
    lines.push(`Observacao do aprovador: ${adminComment}`);
  }
  return lines.join("\n");
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { admin, status } = await requireGlobalDeveloperWithStatus(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
    }

    const body = (await req.json().catch(() => null)) as AcceptBody | null;
    const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
    const { id } = await context.params;

    if (shouldUseJsonStore()) {
      const existing = await getAccessRequestById(id);
      if (!existing) {
        return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
      }
      if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
        return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
      }

      const prepared = await prepareAcceptanceMessage(existing.message, existing.email, body ?? {});
      const createdUserId = existing.user_id ?? (await ensureLocalUser(prepared.message, existing.email));
      const updated = await updateAccessRequest(id, {
        status: "closed",
        message: prepared.message,
        user_id: createdUserId,
      });

      await createAccessRequestComment({
        requestId: id,
        authorRole: "admin",
        authorName: admin.email || "Global",
        authorEmail: admin.email || null,
        authorId: admin.id || null,
        body: buildApprovalComment(prepared.generatedUsername, comment),
      });

      return NextResponse.json({
        ok: true,
        item: {
          id: updated?.id ?? id,
          status: updated?.status ?? "closed",
          username: prepared.generatedUsername,
        },
      });
    }

    try {
      const existing = await prisma.supportRequest.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
      }
      if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
        return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
      }

      const prepared = await prepareAcceptanceMessage(existing.message, existing.email, body ?? {});
      const createdUserId = (existing as { user_id?: string | null }).user_id ?? (await ensureLocalUser(prepared.message, existing.email));

      const updated = await prisma.supportRequest.update({
        where: { id },
        data: {
          status: "closed",
          message: prepared.message,
          user_id: createdUserId,
        } as never,
      });

      await createAccessRequestComment({
        requestId: id,
        authorRole: "admin",
        authorName: admin.email || "Global",
        authorEmail: admin.email || null,
        authorId: admin.id || null,
        body: buildApprovalComment(prepared.generatedUsername, comment),
      });

      return NextResponse.json({
        ok: true,
        item: {
          id: updated.id,
          status: updated.status,
          username: prepared.generatedUsername,
        },
      });
    } catch (error) {
      console.error("[ACCESS-REQUESTS][ACCEPT][PRISMA_FALLBACK]", error);
      const existing = await getAccessRequestById(id);
      if (!existing) {
        return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
      }
      if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
        return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
      }

      const prepared = await prepareAcceptanceMessage(existing.message, existing.email, body ?? {});
      const createdUserId = existing.user_id ?? (await ensureLocalUser(prepared.message, existing.email));
      const updated = await updateAccessRequest(id, {
        status: "closed",
        message: prepared.message,
        user_id: createdUserId,
      });

      await createAccessRequestComment({
        requestId: id,
        authorRole: "admin",
        authorName: admin.email || "Global",
        authorEmail: admin.email || null,
        authorId: admin.id || null,
        body: buildApprovalComment(prepared.generatedUsername, comment),
      });

      return NextResponse.json({
        ok: true,
        item: {
          id: updated?.id ?? id,
          status: updated?.status ?? "closed",
          username: prepared.generatedUsername,
        },
      });
    }
  } catch (err) {
    const createUserError = toCreateUserError(err);
    if (createUserError) {
      return NextResponse.json({ error: createUserError.error }, { status: createUserError.status });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ACCESS-REQUESTS][ACCEPT][ERROR]", err);
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
