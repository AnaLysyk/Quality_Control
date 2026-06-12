import { randomBytes, randomUUID } from "crypto";

import {
  createAccessRequest,
  getAccessRequestById,
  listAccessRequests,
  updateAccessRequest,
  type AccessRequestStatus,
} from "@/data/accessRequestsStore";
import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
import { prisma } from "@/lib/prismaClient";
import { shouldUseJsonStore } from "@/lib/storeMode";
import {
  type AccessRequestV2,
  type AccessRequestAdjustmentEntry,
  type AccessRequestAdjustmentField,
  type AccessRequestAdjustmentRound,
  type AccessRequestV2Priority,
  type AccessRequestV2Details,
  type AccessRequestV2Status,
  type AccessRequestV2Type,
  normalizeAccessRequestAdjustmentFields,
  normalizeAccessRequestV2Priority,
  normalizeAccessRequestV2Status,
  normalizeAccessRequestV2Type,
} from "./domain";

const V2_PREFIX = "ARV2:";

type V2Meta = {
  requestType: AccessRequestV2Type;
  status: AccessRequestV2Status;
  priority: AccessRequestV2Priority;
  requesterUserId?: string;
  requesterName?: string;
  requesterEmail: string;
  requestedRole?: string;
  requestedCompanySlug?: string;
  requestedCompanyId?: string;
  targetUserId?: string;
  requestedPasswordHash?: string;
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  /** Chave pública opaca para consulta sem login */
  accessKey?: string;
  /** Campos sinalizados para ajuste pelo revisor */
  adjustmentFields?: AccessRequestAdjustmentField[];
  details?: AccessRequestV2Details;
  adjustmentHistory?: AccessRequestAdjustmentRound[];
  lastAdjustmentAt?: string;
  lastAdjustmentDiff?: AccessRequestAdjustmentEntry[];
  createdAt: string;
  updatedAt: string;
};

function parseV2Message(message: string): V2Meta | null {
  if (!message.startsWith(V2_PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(V2_PREFIX.length)) as Partial<V2Meta>;
    if (!parsed || typeof parsed !== "object") return null;
    const requestType = normalizeAccessRequestV2Type(parsed.requestType ?? null);
    const status = normalizeAccessRequestV2Status(parsed.status ?? null);
    if (!requestType || !status || typeof parsed.requesterEmail !== "string") return null;

    return {
      requestType,
      status,
      priority: normalizeAccessRequestV2Priority(parsed.priority),
      requesterUserId: parsed.requesterUserId,
      requesterName: parsed.requesterName,
      requesterEmail: parsed.requesterEmail,
      requestedRole: parsed.requestedRole,
      requestedCompanySlug: parsed.requestedCompanySlug,
      requestedCompanyId: parsed.requestedCompanyId,
      targetUserId: parsed.targetUserId,
      requestedPasswordHash: parsed.requestedPasswordHash,
      reason: parsed.reason,
      reviewedBy: parsed.reviewedBy,
      reviewedAt: parsed.reviewedAt,
      reviewComment: parsed.reviewComment,
      accessKey: parsed.accessKey,
      adjustmentFields: normalizeAccessRequestAdjustmentFields(parsed.adjustmentFields),
      details: parsed.details,
      adjustmentHistory: Array.isArray(parsed.adjustmentHistory) ? parsed.adjustmentHistory : [],
      lastAdjustmentAt: parsed.lastAdjustmentAt,
      lastAdjustmentDiff: Array.isArray(parsed.lastAdjustmentDiff) ? parsed.lastAdjustmentDiff : [],
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function stringifyV2Message(meta: V2Meta) {
  return `${V2_PREFIX}${JSON.stringify(meta)}`;
}

function toLegacyAccessRequestStatus(status: AccessRequestV2Status): AccessRequestStatus {
  if (status === "approved") return "closed";
  if (status === "rejected" || status === "cancelled" || status === "expired") return "rejected";
  if (status === "under_review" || status === "needs_more_info") return "in_progress";
  return "open";
}

function mapPrismaRowToV2(row: {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  profileType: string | null;
  clientId: string | null;
  company: string | null;
  accessType: string;
  description: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AccessRequestV2 {
  let requestType = normalizeAccessRequestV2Type(row.accessType) ?? "profile_change";
  let status = normalizeAccessRequestV2Status(row.status) ?? "pending";
  let priority: AccessRequestV2Priority = "medium";
  let reviewedBy: string | undefined;
  let reviewedAt: string | undefined;
  let reviewComment: string | undefined;
  let targetUserId: string | undefined;
  let requestedPasswordHash: string | undefined;
  let requestedCompanySlug: string | undefined;
  let accessKey: string | undefined;
  let adjustmentFields: AccessRequestAdjustmentField[] | undefined;
  let details: AccessRequestV2Details | undefined;
  let adjustmentHistory: AccessRequestAdjustmentRound[] | undefined;
  let lastAdjustmentAt: string | undefined;
  let lastAdjustmentDiff: AccessRequestAdjustmentEntry[] | undefined;

  if (row.adminNotes?.startsWith(V2_PREFIX)) {
    const meta = parseV2Message(row.adminNotes);
    if (meta) {
      requestType = meta.requestType;
      status = meta.status;
      priority = meta.priority;
      reviewedBy = meta.reviewedBy;
      reviewedAt = meta.reviewedAt;
      reviewComment = meta.reviewComment;
      targetUserId = meta.targetUserId;
      requestedPasswordHash = meta.requestedPasswordHash;
      requestedCompanySlug = meta.requestedCompanySlug;
      accessKey = meta.accessKey;
      adjustmentFields = meta.adjustmentFields;
      details = meta.details;
      adjustmentHistory = meta.adjustmentHistory;
      lastAdjustmentAt = meta.lastAdjustmentAt;
      lastAdjustmentDiff = meta.lastAdjustmentDiff;
    }
  }

  return {
    id: row.id,
    accessKey,
    requesterUserId: row.userId ?? undefined,
    requesterEmail: row.email,
    requesterName: row.name ?? undefined,
    requestType,
    requestedRole: row.profileType ?? undefined,
    requestedCompanySlug,
    requestedCompanyId: row.clientId ?? undefined,
    targetUserId,
    requestedPasswordHash,
    status,
    reason: row.description ?? undefined,
    priority,
    reviewedBy,
    reviewedAt,
    reviewComment,
    adjustmentFields: normalizeAccessRequestAdjustmentFields(adjustmentFields),
    details,
    adjustmentHistory,
    lastAdjustmentAt,
    lastAdjustmentDiff,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAccessRequestsV2(filters?: {
  requesterUserId?: string;
  status?: AccessRequestV2Status;
  requestType?: AccessRequestV2Type;
}) {
  if (!shouldUseJsonStore()) {
    const rows = await prisma.accessRequest.findMany({
      where: {
        ...(filters?.requesterUserId ? { userId: filters.requesterUserId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = rows.map((row) => mapPrismaRowToV2(row));
    return mapped.filter(
      (item) =>
        (!filters?.status || item.status === filters.status) &&
        (!filters?.requestType || item.requestType === filters.requestType),
    );
  }

  const records = await listAccessRequests();
  return records
    .map((record) => {
      const meta = parseV2Message(record.message);
      if (meta) {
        return {
          id: record.id,
          accessKey: meta.accessKey,
          requesterUserId: record.user_id ?? undefined,
          requesterEmail: meta.requesterEmail,
          requesterName: meta.requesterName,
          requestType: meta.requestType,
          requestedRole: meta.requestedRole,
          requestedCompanySlug: meta.requestedCompanySlug,
          requestedCompanyId: meta.requestedCompanyId,
          targetUserId: meta.targetUserId,
          requestedPasswordHash: meta.requestedPasswordHash,
          status: meta.status,
          reason: meta.reason,
          priority: meta.priority,
          reviewedBy: meta.reviewedBy,
          reviewedAt: meta.reviewedAt,
          reviewComment: meta.reviewComment,
          adjustmentFields: meta.adjustmentFields,
          details: meta.details,
          adjustmentHistory: meta.adjustmentHistory,
          lastAdjustmentAt: meta.lastAdjustmentAt,
          lastAdjustmentDiff: meta.lastAdjustmentDiff,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
        } as AccessRequestV2;
      }

      const parsedLegacy = parseAccessRequestMessage(record.message, record.email);
      return {
        id: record.id,
        requesterUserId: record.user_id ?? undefined,
        requesterEmail: parsedLegacy.email || record.email,
        requesterName: parsedLegacy.fullName || parsedLegacy.name || undefined,
        requestType: normalizeAccessRequestV2Type(parsedLegacy.profileType) ?? "profile_change",
        requestedRole: parsedLegacy.profileType || undefined,
        requestedCompanyId: parsedLegacy.clientId || undefined,
        status: normalizeAccessRequestV2Status(record.status) ?? "pending",
        reason: parsedLegacy.description || undefined,
        priority: "medium",
        details: {
          username: parsedLegacy.username ?? undefined,
          phone: parsedLegacy.phone || undefined,
          jobRole: parsedLegacy.jobRole || undefined,
          title: parsedLegacy.title || undefined,
          description: parsedLegacy.description || undefined,
          notes: parsedLegacy.notes || undefined,
          company: parsedLegacy.companyProfile
            ? {
                companyName: parsedLegacy.companyProfile.companyName || undefined,
                cnpj: parsedLegacy.companyProfile.companyTaxId || undefined,
                cep: parsedLegacy.companyProfile.companyZip || undefined,
                address: parsedLegacy.companyProfile.companyAddress || undefined,
                phone: parsedLegacy.companyProfile.companyPhone || undefined,
                website: parsedLegacy.companyProfile.companyWebsite || undefined,
                linkedin: parsedLegacy.companyProfile.companyLinkedin || undefined,
                description: parsedLegacy.companyProfile.companyDescription || undefined,
                notes: parsedLegacy.companyProfile.companyNotes || undefined,
              }
            : undefined,
        },
        adjustmentFields: normalizeAccessRequestAdjustmentFields(parsedLegacy.adjustmentRequestedFields),
        adjustmentHistory: parsedLegacy.adjustmentHistory.map((round) => ({
          round: round.round,
          requestedAt: round.requestedAt,
          requestedFields: normalizeAccessRequestAdjustmentFields(round.requestedFields),
          requestMessage: round.requestMessage ?? undefined,
          requesterReturnedAt: round.requesterReturnedAt ?? undefined,
          requesterDiff: round.requesterDiff?.map((entry) => ({
            field: entry.field as AccessRequestAdjustmentField,
            label: entry.label,
            previous: entry.previous,
            next: entry.next,
          })),
        })),
        lastAdjustmentAt: parsedLegacy.lastAdjustmentAt ?? undefined,
        lastAdjustmentDiff: parsedLegacy.lastAdjustmentDiff.map((entry) => ({
          field: entry.field as AccessRequestAdjustmentField,
          label: entry.label,
          previous: entry.previous,
          next: entry.next,
        })),
        createdAt: record.created_at,
        updatedAt: record.updated_at ?? record.created_at,
      } as AccessRequestV2;
    })
    .filter(
      (item) =>
        (!filters?.requesterUserId || item.requesterUserId === filters.requesterUserId) &&
        (!filters?.status || item.status === filters.status) &&
        (!filters?.requestType || item.requestType === filters.requestType),
    );
}

export async function getAccessRequestV2ByKey(accessKey: string) {
  if (!shouldUseJsonStore()) {
    // Busca em adminNotes via LIKE (contém o accessKey serializado no JSON)
    const rows = await prisma.accessRequest.findMany({
      where: { adminNotes: { contains: accessKey } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const mapped = rows.map((row) => mapPrismaRowToV2(row));
    return mapped.find((item) => item.accessKey === accessKey) ?? null;
  }

  const all = await listAccessRequestsV2();
  return all.find((item) => item.accessKey === accessKey) ?? null;
}

export async function getAccessRequestV2ById(id: string) {
  if (!shouldUseJsonStore()) {
    const row = await prisma.accessRequest.findUnique({ where: { id } });
    if (!row) return null;
    return mapPrismaRowToV2(row);
  }

  const record = await getAccessRequestById(id);
  if (!record) return null;
  const all = await listAccessRequestsV2();
  return all.find((item) => item.id === id) ?? null;
}

export async function createAccessRequestV2(input: {
  requesterUserId?: string;
  requesterEmail: string;
  requesterName?: string;
  requestType: AccessRequestV2Type;
  requestedRole?: string;
  requestedCompanySlug?: string;
  requestedCompanyId?: string;
  targetUserId?: string;
  requestedPasswordHash?: string;
  details?: AccessRequestV2Details;
  reason?: string;
  priority?: AccessRequestV2Priority;
}) {
  const now = new Date().toISOString();
  const request: AccessRequestV2 = {
    id: randomUUID(),
    accessKey: randomBytes(20).toString("hex"),
    requesterUserId: input.requesterUserId,
    requesterEmail: input.requesterEmail,
    requesterName: input.requesterName,
    requestType: input.requestType,
    requestedRole: input.requestedRole,
    requestedCompanySlug: input.requestedCompanySlug,
    requestedCompanyId: input.requestedCompanyId,
    targetUserId: input.targetUserId,
    requestedPasswordHash: input.requestedPasswordHash,
    status: "pending",
    reason: input.reason,
    details: input.details,
    priority: normalizeAccessRequestV2Priority(input.priority),
    createdAt: now,
    updatedAt: now,
  };

  if (!shouldUseJsonStore()) {
    const meta: V2Meta = {
      requestType: request.requestType,
      status: request.status,
      priority: request.priority,
      requesterUserId: request.requesterUserId,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      requestedRole: request.requestedRole,
      requestedCompanySlug: request.requestedCompanySlug,
      requestedCompanyId: request.requestedCompanyId,
      targetUserId: request.targetUserId,
      requestedPasswordHash: request.requestedPasswordHash,
      reason: request.reason,
      details: request.details,
      adjustmentHistory: [],
      lastAdjustmentDiff: [],
      accessKey: request.accessKey,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };

    const created = await prisma.accessRequest.create({
      data: {
        email: request.requesterEmail,
        name: request.requesterName ?? null,
        userId: request.requesterUserId ?? null,
        accessType: request.requestType,
        profileType: request.requestedRole ?? null,
        company: request.requestedCompanySlug ?? null,
        clientId: request.requestedCompanyId ?? null,
        description: request.reason ?? null,
        status: request.status,
        adminNotes: stringifyV2Message(meta),
      },
    });

    return mapPrismaRowToV2(created);
  }

  const meta: V2Meta = {
    requestType: request.requestType,
    status: request.status,
    priority: request.priority,
    requesterUserId: request.requesterUserId,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail,
    requestedRole: request.requestedRole,
    requestedCompanySlug: request.requestedCompanySlug,
    requestedCompanyId: request.requestedCompanyId,
    targetUserId: request.targetUserId,
    requestedPasswordHash: request.requestedPasswordHash,
    reason: request.reason,
    details: request.details,
    adjustmentHistory: [],
    lastAdjustmentDiff: [],
    accessKey: request.accessKey,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };

  const created = await createAccessRequest({
    email: request.requesterEmail,
    message: stringifyV2Message(meta),
    status: toLegacyAccessRequestStatus(request.status),
    user_id: request.requesterUserId ?? null,
  });

  return {
    ...request,
    id: created.id,
  };
}

export async function updateAccessRequestV2(
  id: string,
  patch: Partial<Pick<AccessRequestV2, "status" | "priority" | "reviewedBy" | "reviewedAt" | "reviewComment" | "reason" | "adjustmentFields" | "requestedPasswordHash" | "requesterName" | "requesterEmail" | "requestedRole" | "details" | "adjustmentHistory" | "lastAdjustmentAt" | "lastAdjustmentDiff">> & {
    requestedCompanySlug?: string | null;
    requestedCompanyId?: string | null;
  },
) {
  const current = await getAccessRequestV2ById(id);
  if (!current) return null;

  const next: AccessRequestV2 = {
    ...current,
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.priority ? { priority: patch.priority } : {}),
    ...(patch.reviewedBy !== undefined ? { reviewedBy: patch.reviewedBy } : {}),
    ...(patch.reviewedAt !== undefined ? { reviewedAt: patch.reviewedAt } : {}),
    ...(patch.reviewComment !== undefined ? { reviewComment: patch.reviewComment } : {}),
    ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
    ...(patch.requestedPasswordHash !== undefined ? { requestedPasswordHash: patch.requestedPasswordHash } : {}),
    ...(patch.adjustmentFields !== undefined ? { adjustmentFields: patch.adjustmentFields } : {}),
    ...(patch.requesterName !== undefined ? { requesterName: patch.requesterName } : {}),
    ...(patch.requesterEmail !== undefined ? { requesterEmail: patch.requesterEmail } : {}),
    ...(patch.requestedRole !== undefined ? { requestedRole: patch.requestedRole } : {}),
    ...(patch.requestedCompanySlug !== undefined ? { requestedCompanySlug: patch.requestedCompanySlug ?? undefined } : {}),
    ...(patch.requestedCompanyId !== undefined ? { requestedCompanyId: patch.requestedCompanyId ?? undefined } : {}),
    ...(patch.details !== undefined ? { details: patch.details } : {}),
    ...(patch.adjustmentHistory !== undefined ? { adjustmentHistory: patch.adjustmentHistory } : {}),
    ...(patch.lastAdjustmentAt !== undefined ? { lastAdjustmentAt: patch.lastAdjustmentAt } : {}),
    ...(patch.lastAdjustmentDiff !== undefined ? { lastAdjustmentDiff: patch.lastAdjustmentDiff } : {}),
    updatedAt: new Date().toISOString(),
  };

  if (!shouldUseJsonStore()) {
    const meta: V2Meta = {
      requestType: next.requestType,
      status: next.status,
      priority: next.priority,
      requesterUserId: next.requesterUserId,
      requesterName: next.requesterName,
      requesterEmail: next.requesterEmail,
      requestedRole: next.requestedRole,
      requestedCompanySlug: next.requestedCompanySlug,
      requestedCompanyId: next.requestedCompanyId,
      targetUserId: next.targetUserId,
      requestedPasswordHash: next.requestedPasswordHash,
      reason: next.reason,
      reviewedBy: next.reviewedBy,
      reviewedAt: next.reviewedAt,
      reviewComment: next.reviewComment,
      accessKey: next.accessKey,
      adjustmentFields: next.adjustmentFields,
      details: next.details,
      adjustmentHistory: next.adjustmentHistory,
      lastAdjustmentAt: next.lastAdjustmentAt,
      lastAdjustmentDiff: next.lastAdjustmentDiff,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    };

    const updated = await prisma.accessRequest.update({
      where: { id },
      data: {
        status: next.status,
        email: next.requesterEmail,
        name: next.requesterName ?? null,
        profileType: next.requestedRole ?? null,
        company: next.requestedCompanySlug ?? null,
        clientId: next.requestedCompanyId ?? null,
        description: next.reason ?? null,
        adminNotes: stringifyV2Message(meta),
      },
    });

    return mapPrismaRowToV2(updated);
  }

  const meta: V2Meta = {
    requestType: next.requestType,
    status: next.status,
    priority: next.priority,
    requesterUserId: next.requesterUserId,
    requesterName: next.requesterName,
    requesterEmail: next.requesterEmail,
    requestedRole: next.requestedRole,
    requestedCompanySlug: next.requestedCompanySlug,
    requestedCompanyId: next.requestedCompanyId,
    targetUserId: next.targetUserId,
    requestedPasswordHash: next.requestedPasswordHash,
    reason: next.reason,
    reviewedBy: next.reviewedBy,
    reviewedAt: next.reviewedAt,
    reviewComment: next.reviewComment,
    accessKey: next.accessKey,
    adjustmentFields: next.adjustmentFields,
    details: next.details,
    adjustmentHistory: next.adjustmentHistory,
    lastAdjustmentAt: next.lastAdjustmentAt,
    lastAdjustmentDiff: next.lastAdjustmentDiff,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  };

  await updateAccessRequest(id, {
    email: next.requesterEmail,
    status: toLegacyAccessRequestStatus(next.status),
    message: stringifyV2Message(meta),
  });

  return next;
}
