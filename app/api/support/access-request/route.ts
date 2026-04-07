import { NextResponse } from "next/server";

import { createAccessRequest, listAccessRequests } from "@/data/accessRequestsStore";
import { findLocalCompanyById } from "@/lib/auth/localStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import {
  composeAccessRequestMessage,
  normalizeAccessType,
  type AccessType,
} from "@/lib/accessRequestMessage";
import { notifyAccessRequestCreated } from "@/lib/notificationService";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import {
  normalizeRequestProfileType,
  requestProfileTypeNeedsCompany,
  resolveReviewQueue,
  resolveRequestQueueMessage,
  toInternalAccessType,
  toRequestProfileTypeLabel,
  type RequestProfileType,
} from "@/lib/requestRouting";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { addAuditLogSafe } from "@/data/auditLogRepository";

type Payload = {
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

function sanitize(value: unknown, max = 255): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = sanitize(body.email, 255).toLowerCase();
  const company = sanitize(body.company, 255);
  const clientId = sanitize(body.client_id, 128);
  const fullName = sanitize(body.full_name, 255) || sanitize(body.name, 255);
  const name = fullName;
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
    null;
  const accessType = profileType ? toInternalAccessType(profileType) : accessTypeRaw ? normalizeAccessType(accessTypeRaw) : null;

  if (!email || !name || !fullName || !role || !phone || !password || !title || !description || !profileType || !accessType) {
    return NextResponse.json({ message: "Campos obrigatorios ausentes" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "Senha obrigatoria com pelo menos 8 caracteres" }, { status: 400 });
  }

  let resolvedCompanyName = company || "";
  let resolvedClientId = clientId || null;

  if (requestProfileTypeNeedsCompany(profileType)) {
    if (!resolvedClientId) {
      return NextResponse.json(
        { message: "Selecione uma empresa cadastrada para vincular ao perfil Usuario" },
        { status: 400 },
      );
    }

    const selectedCompany = await findLocalCompanyById(resolvedClientId);
    if (!selectedCompany) {
      return NextResponse.json({ message: "Empresa selecionada nao encontrada" }, { status: 404 });
    }

    resolvedCompanyName = (selectedCompany.name ?? selectedCompany.company_name ?? "").trim() || "Empresa";
  } else if (profileType === "company_user") {
    if (!companyProfile.companyName) {
      return NextResponse.json({ message: "Informe o nome ou razao social da empresa" }, { status: 400 });
    }
    resolvedCompanyName = companyProfile.companyName;
    resolvedClientId = null;
  }

  const authUser = await authenticateRequest(req);
  const userId = authUser?.id ?? null;
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;

  const composedMessage = composeAccessRequestMessage({
    email,
    name,
    fullName: fullName || null,
    username: username || null,
    phone: phone || null,
    passwordHash: hashPasswordSha256(password),
    role,
    company: resolvedCompanyName || "(nao informado)",
    clientId: resolvedClientId,
    accessType,
    profileType,
    title,
    description,
    notes,
    companyProfile,
  });

  const useJson = shouldUseJsonStore();
  if (useJson) {
    const created = await createAccessRequest({
      email,
      message: composedMessage,
      status: "open",
      ip_address,
      user_agent,
      user_id: userId,
    });
    await notifyAccessRequestCreated({
      requestId: created.id,
        requesterName: fullName,
      profileType,
      reviewQueue: resolveReviewQueue(profileType),
    });
  } else {
    try {
      const created = await prisma.supportRequest.create({
        data: {
          email,
          message: composedMessage,
          status: "open",
          ip_address,
          user_agent,
          user_id: userId,
        },
      });
      await notifyAccessRequestCreated({
        requestId: created.id,
        requesterName: fullName,
        profileType,
        reviewQueue: resolveReviewQueue(profileType),
      });
    } catch (error) {
      console.error("Erro ao registrar support_request:", error);
      try {
        const created = await createAccessRequest({
          email,
          message: composedMessage,
          status: "open",
          ip_address,
          user_agent,
          user_id: userId,
        });
        await notifyAccessRequestCreated({
          requestId: created.id,
          requesterName: fullName,
          profileType,
          reviewQueue: resolveReviewQueue(profileType),
        });
      } catch (jsonError) {
        console.error("Fallback JSON store falhou:", jsonError);
        return NextResponse.json({ message: "Erro interno ao registrar solicitacao" }, { status: 500 });
      }
    }
  }

  addAuditLogSafe({
    actorEmail: email,
    actorUserId: userId,
    action: "access_request.created",
    entityType: "access_request",
    entityLabel: `${fullName} (${email})`,
    metadata: { profileType, accessType, company: resolvedCompanyName || null, ip: ip_address },
  });

  return NextResponse.json({
    ok: true,
    message: resolveRequestQueueMessage(resolveReviewQueue(profileType)),
  });
}

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ message: status === 401 ? "Nao autorizado" : "Acesso proibido" }, { status });
  }

  const useJson = shouldUseJsonStore();
  if (useJson) {
    const items = await listAccessRequests();
    return NextResponse.json({ items });
  }

  try {
    const items = await prisma.supportRequest.findMany({
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erro ao listar support_requests:", error);
    const items = await listAccessRequests();
    return NextResponse.json({ items });
  }
}
