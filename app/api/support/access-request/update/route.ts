import { NextResponse } from "next/server";

import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import { getAccessRequestById, listAccessRequests, updateAccessRequest } from "@/data/accessRequestsStore";
import { findLocalCompanyById } from "@/lib/auth/localStore";
import {
  type AccessRequestAdjustmentEntry,
  type AccessRequestAdjustmentField,
  type AccessRequestAdjustmentRound,
  composeAccessRequestMessage,
  normalizeAccessType,
  parseAccessRequestMessage,
  type AccessType,
} from "@/lib/accessRequestMessage";
import { notifyAccessRequestComment } from "@/lib/notificationService";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { prisma } from "@/lib/prismaClient";
import {
  normalizeRequestProfileType,
  requestProfileTypeNeedsCompany,
  resolveReviewQueue,
  toInternalAccessType,
  type RequestProfileType,
} from "@/lib/requestRouting";
import { shouldUseJsonStore } from "@/lib/storeMode";

type SupportRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: Date | string;
  user_id?: string | null;
};

type Payload = {
  requestId?: string;
  lookup_name?: string;
  lookup_email?: string;
  email?: string;
  company?: string;
  client_id?: string;
  company_name?: string;
  company_tax_id?: string;
  company_zip?: string;
  company_address?: string;
  company_phone?: string;
  company_website?: string;
  company_linkedin?: string;
  company_description?: string;
  company_notes?: string;
  name?: string;
  full_name?: string;
  user?: string;
  phone?: string;
  role?: string;
  access_type?: string;
  profile_type?: string;
  title?: string;
  description?: string;
  password?: string;
  notes?: string;
};

type AdjustmentSnapshot = {
  profileType: string;
  company: string;
  companyName: string;
  companyTaxId: string;
  companyZip: string;
  companyAddress: string;
  companyPhone: string;
  companyWebsite: string;
  companyLinkedin: string;
  companyDescription: string;
  companyNotes: string;
  fullName: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  jobRole: string;
  title: string;
  description: string;
  notes: string;
  passwordHash: string;
};

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sanitize(value: unknown, max = 255): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function buildAdjustmentDiff(previous: AdjustmentSnapshot, next: AdjustmentSnapshot): AccessRequestAdjustmentEntry[] {
  const fields: Array<{ field: AccessRequestAdjustmentEntry["field"]; label: string; previous: string; next: string }> = [
    { field: "profileType", label: "Tipo de perfil", previous: previous.profileType, next: next.profileType },
    { field: "company", label: "Empresa vinculada", previous: previous.company, next: next.company },
    { field: "companyName", label: "Nome da empresa", previous: previous.companyName, next: next.companyName },
    { field: "companyTaxId", label: "CNPJ", previous: previous.companyTaxId, next: next.companyTaxId },
    { field: "companyZip", label: "CEP", previous: previous.companyZip, next: next.companyZip },
    { field: "companyAddress", label: "Endereco", previous: previous.companyAddress, next: next.companyAddress },
    { field: "companyPhone", label: "Telefone da empresa", previous: previous.companyPhone, next: next.companyPhone },
    { field: "companyWebsite", label: "Website", previous: previous.companyWebsite, next: next.companyWebsite },
    { field: "companyLinkedin", label: "LinkedIn", previous: previous.companyLinkedin, next: next.companyLinkedin },
    { field: "companyDescription", label: "Descricao da empresa", previous: previous.companyDescription, next: next.companyDescription },
    { field: "companyNotes", label: "Observacoes da empresa", previous: previous.companyNotes, next: next.companyNotes },
    { field: "fullName", label: "Nome completo", previous: previous.fullName, next: next.fullName },
    { field: "username", label: "Usuario/login", previous: previous.username, next: next.username },
    { field: "email", label: "E-mail", previous: previous.email, next: next.email },
    { field: "phone", label: "Telefone", previous: previous.phone, next: next.phone },
    { field: "jobRole", label: "Cargo", previous: previous.jobRole, next: next.jobRole },
    { field: "title", label: "Titulo", previous: previous.title, next: next.title },
    { field: "description", label: "Descricao", previous: previous.description, next: next.description },
    { field: "notes", label: "Observacoes", previous: previous.notes, next: next.notes },
    {
      field: "password",
      label: "Senha",
      previous: previous.passwordHash ? "Definida" : "Nao definida",
      next: next.passwordHash ? "Definida" : "Nao definida",
    },
  ];

  return fields
    .filter((entry) => entry.previous !== entry.next)
    .map((entry) => ({
      field: entry.field,
      label: entry.label,
      previous: entry.previous || "Nao informado",
      next: entry.next || "Nao informado",
    }));
}

function buildAdjustmentComment(diff: AccessRequestAdjustmentEntry[]) {
  if (!diff.length) {
    return "Solicitante reenviou a solicitacao sem alterar os dados informados.";
  }
  const lines = [
    "Solicitante ajustou os dados da solicitacao e reenviou para revisao.",
    ...diff.map((entry) => `- ${entry.label}: ${entry.previous} -> ${entry.next}`),
  ];
  return lines.join("\n");
}

function isFieldEditableDuringAdjustment(field: AccessRequestAdjustmentField, requestedFields: AccessRequestAdjustmentField[]) {
  if (requestedFields.includes(field)) return true;
  if (field === "company" && requestedFields.includes("companyName")) return true;
  return false;
}

async function findRequestById(id: string): Promise<SupportRequestRow | null> {
  if (shouldUseJsonStore()) {
    const item = await getAccessRequestById(id);
    if (!item) return null;
    return {
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: item.user_id ?? null,
    };
  }

  try {
    const item = await prisma.supportRequest.findUnique({ where: { id } });
    if (!item) return null;
    return {
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: (item as { user_id?: string | null }).user_id ?? null,
    };
  } catch (error) {
    console.error("[ACCESS-REQUESTS][UPDATE][FIND_BY_ID][PRISMA_FALLBACK]", error);
    const item = await getAccessRequestById(id);
    if (!item) return null;
    return {
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: item.user_id ?? null,
    };
  }
}

async function findRequestByLookup(email: string, name: string): Promise<SupportRequestRow | null> {
  const normalizedEmail = normalizeLookup(email);
  const normalizedName = normalizeLookup(name);
  if (!normalizedEmail || !normalizedName) return null;

  let items: SupportRequestRow[] = [];
  if (shouldUseJsonStore()) {
    const list = await listAccessRequests();
    items = list.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: item.user_id ?? null,
    }));
  } else {
    try {
      const list = (await prisma.supportRequest.findMany({
        where: { email: email.trim().toLowerCase() },
        orderBy: { created_at: "desc" },
      })) as SupportRequestRow[];
      items = list.map((item) => ({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
        user_id: (item as { user_id?: string | null }).user_id ?? null,
      }));
    } catch (error) {
      console.error("[ACCESS-REQUESTS][UPDATE][FIND_BY_LOOKUP][PRISMA_FALLBACK]", error);
      const list = await listAccessRequests();
      items = list.map((item) => ({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
        user_id: item.user_id ?? null,
      }));
    }
  }

  return (
    items.find((item) => {
      if (normalizeLookup(item.email ?? "") !== normalizedEmail) return false;
      const parsed = parseAccessRequestMessage(String(item.message ?? ""), String(item.email ?? ""));
      return normalizeLookup(parsed.fullName || parsed.name || "") === normalizedName;
    }) ?? null
  );
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const requestId = sanitize(body.requestId, 120);
  const lookupName = sanitize(body.lookup_name, 255);
  const lookupEmail = sanitize(body.lookup_email, 255).toLowerCase();

  if (!lookupName || !lookupEmail) {
    return NextResponse.json({ error: "Informe nome e e-mail usados na consulta." }, { status: 400 });
  }

  const request = requestId ? await findRequestById(requestId) : await findRequestByLookup(lookupEmail, lookupName);
  if (!request) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
  }

  const parsed = parseAccessRequestMessage(String(request.message ?? ""), String(request.email ?? ""));
  if (
    normalizeLookup(parsed.fullName || parsed.name || "") !== normalizeLookup(lookupName) ||
    normalizeLookup(request.email ?? "") !== normalizeLookup(lookupEmail)
  ) {
    return NextResponse.json({ error: "Dados nao conferem com a solicitacao." }, { status: 403 });
  }

  if (request.status === "closed" || request.status === "rejected") {
    return NextResponse.json({ error: "Esta solicitacao ja foi finalizada e nao aceita ajustes." }, { status: 409 });
  }

  const email = sanitize(body.email, 255).toLowerCase();
  const company = sanitize(body.company, 255);
  const clientId = sanitize(body.client_id, 128);
  const fullName = sanitize(body.full_name, 255) || sanitize(body.name, 255);
  const displayName = fullName;
  const username = sanitize(body.user, 120).toLowerCase();
  const phone = sanitize(body.phone, 64);
  const role = sanitize(body.role, 255);
  const notes = sanitize(body.notes, 1000);
  const title = sanitize(body.title, 255);
  const description = sanitize(body.description, 2000);
  const password = sanitize(body.password, 128);
  const companyProfile = {
    companyName: sanitize(body.company_name, 255),
    companyTaxId: sanitize(body.company_tax_id, 64),
    companyZip: sanitize(body.company_zip, 32),
    companyAddress: sanitize(body.company_address, 255),
    companyPhone: sanitize(body.company_phone, 64),
    companyWebsite: sanitize(body.company_website, 255),
    companyLinkedin: sanitize(body.company_linkedin, 255),
    companyDescription: sanitize(body.company_description, 1000),
    companyNotes: sanitize(body.company_notes, 1000),
  };
  const accessTypeRaw = sanitize(body.access_type, 40);
  const profileTypeRaw = sanitize(body.profile_type, 80);
  const profileType =
    normalizeRequestProfileType(profileTypeRaw) ??
    normalizeRequestProfileType(accessTypeRaw) ??
    parsed.profileType ??
    null;
  const accessType =
    (profileType ? toInternalAccessType(profileType) : null) ??
    (accessTypeRaw ? normalizeAccessType(accessTypeRaw) : null) ??
    parsed.accessType ??
    null;

  if (!email || !fullName || !role || !phone || !title || !description || !profileType || !accessType) {
    return NextResponse.json({ error: "Campos obrigatorios ausentes para atualizar a solicitacao." }, { status: 400 });
  }

  const nextPasswordHash = password ? hashPasswordSha256(password) : parsed.passwordHash;
  if (!nextPasswordHash) {
    return NextResponse.json({ error: "Defina uma senha para prosseguir com a solicitacao." }, { status: 400 });
  }

  let resolvedCompanyName = company || parsed.company || "";
  let resolvedClientId = clientId || parsed.clientId || null;

  if (requestProfileTypeNeedsCompany(profileType)) {
    if (!resolvedClientId) {
      return NextResponse.json({ error: "Selecione uma empresa cadastrada para vincular ao perfil Usuario." }, { status: 400 });
    }

    const selectedCompany = await findLocalCompanyById(resolvedClientId);
    if (!selectedCompany) {
      return NextResponse.json({ error: "Empresa selecionada nao encontrada." }, { status: 404 });
    }
    resolvedCompanyName = (selectedCompany.name ?? selectedCompany.company_name ?? "").trim() || "Empresa";
  } else if (profileType === "company_user") {
    if (!companyProfile.companyName) {
      return NextResponse.json({ error: "Informe o nome ou razao social da empresa." }, { status: 400 });
    }
    resolvedClientId = null;
    resolvedCompanyName = companyProfile.companyName;
  } else {
    resolvedClientId = null;
    resolvedCompanyName = "(nao informado)";
  }

  const previousSnapshot: AdjustmentSnapshot = {
    profileType: parsed.profileType,
    company: parsed.company || "",
    companyName: parsed.companyProfile?.companyName || "",
    companyTaxId: parsed.companyProfile?.companyTaxId || "",
    companyZip: parsed.companyProfile?.companyZip || "",
    companyAddress: parsed.companyProfile?.companyAddress || "",
    companyPhone: parsed.companyProfile?.companyPhone || "",
    companyWebsite: parsed.companyProfile?.companyWebsite || "",
    companyLinkedin: parsed.companyProfile?.companyLinkedin || "",
    companyDescription: parsed.companyProfile?.companyDescription || "",
    companyNotes: parsed.companyProfile?.companyNotes || "",
    fullName: parsed.fullName || "",
    name: parsed.name || "",
    username: parsed.username || "",
    email: parsed.email || request.email || "",
    phone: parsed.phone || "",
    jobRole: parsed.jobRole || "",
    title: parsed.title || "",
    description: parsed.description || "",
    notes: parsed.notes || "",
    passwordHash: parsed.passwordHash || "",
  };

  const nextSnapshot: AdjustmentSnapshot = {
    profileType,
    company: resolvedCompanyName || "",
    companyName: companyProfile.companyName || "",
    companyTaxId: companyProfile.companyTaxId || "",
    companyZip: companyProfile.companyZip || "",
    companyAddress: companyProfile.companyAddress || "",
    companyPhone: companyProfile.companyPhone || "",
    companyWebsite: companyProfile.companyWebsite || "",
    companyLinkedin: companyProfile.companyLinkedin || "",
    companyDescription: companyProfile.companyDescription || "",
    companyNotes: companyProfile.companyNotes || "",
    fullName,
    name: displayName,
    username: username || parsed.username || "",
    email,
    phone,
    jobRole: role,
    title,
    description,
    notes: notes || parsed.notes || "",
    passwordHash: nextPasswordHash || "",
  };

  const adjustmentDiff = buildAdjustmentDiff(previousSnapshot, nextSnapshot);
  const adjustmentTimestamp = new Date().toISOString();
  if (request.status === "in_progress" && parsed.adjustmentRequestedFields.length > 0) {
    const invalidDiff = adjustmentDiff.find((entry) => !isFieldEditableDuringAdjustment(entry.field, parsed.adjustmentRequestedFields));
    if (invalidDiff) {
      return NextResponse.json({ error: `Somente os campos marcados para ajuste podem ser alterados agora: ${invalidDiff.label}.` }, { status: 400 });
    }
  }

  const updatedHistory: AccessRequestAdjustmentRound[] = parsed.adjustmentHistory.map((entry) =>
    entry.round === parsed.adjustmentRound
      ? {
          ...entry,
          requesterReturnedAt: adjustmentTimestamp,
          requesterDiff: adjustmentDiff,
        }
      : entry,
  );

  const message = composeAccessRequestMessage({
    email,
    name: displayName,
    fullName,
    username: username || parsed.username || null,
    phone,
    passwordHash: nextPasswordHash,
    role,
    company: resolvedCompanyName || "(nao informado)",
    clientId: resolvedClientId,
    accessType: accessType as AccessType,
    profileType: profileType as RequestProfileType,
    title,
    description,
    notes: notes || parsed.notes || "",
    companyProfile,
    originalRequest: parsed.originalRequest,
    adjustmentRound: parsed.adjustmentRound,
    adjustmentRequestedFields: [],
    adjustmentHistory: updatedHistory,
    lastAdjustmentAt: adjustmentTimestamp,
    lastAdjustmentDiff: adjustmentDiff,
  });

  const comment = await createAccessRequestComment({
    requestId: request.id,
    authorRole: "requester",
    authorName: fullName || displayName,
    authorEmail: email,
    body: buildAdjustmentComment(adjustmentDiff),
  });

  if (shouldUseJsonStore()) {
    const updated = await updateAccessRequest(request.id, {
      email,
      message,
      status: "open",
    });

    await notifyAccessRequestComment({
      requestId: request.id,
      commentId: comment.id,
      authorName: fullName || displayName,
      body: comment.body,
      reviewQueue: resolveReviewQueue(profileType as RequestProfileType),
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? request.id,
        status: updated?.status ?? "open",
      },
    });
  }

  try {
    const updated = await prisma.supportRequest.update({
      where: { id: request.id },
      data: {
        email,
        message,
        status: "open",
      },
    });

    await notifyAccessRequestComment({
      requestId: request.id,
      commentId: comment.id,
      authorName: fullName || displayName,
      body: comment.body,
      reviewQueue: resolveReviewQueue(profileType as RequestProfileType),
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("[ACCESS-REQUESTS][UPDATE][PRISMA_FALLBACK]", error);
    const updated = await updateAccessRequest(request.id, {
      email,
      message,
      status: "open",
    });

    await notifyAccessRequestComment({
      requestId: request.id,
      commentId: comment.id,
      authorName: fullName || displayName,
      body: comment.body,
      reviewQueue: resolveReviewQueue(profileType as RequestProfileType),
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? request.id,
        status: updated?.status ?? "open",
      },
    });
  }
}
