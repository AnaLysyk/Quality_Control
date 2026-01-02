import { randomUUID } from "crypto";
import type { SessionUser } from "@/lib/session";

export type RequestType = "EMAIL_CHANGE" | "COMPANY_CHANGE";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type RequestRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  companyName: string;
  type: RequestType;
  payload: Record<string, unknown>;
  status: RequestStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
};

let REQUESTS: RequestRecord[] = [
  {
    id: "req_sample_email",
    userId: "usr_001",
    userName: "Usuário",
    userEmail: "user@example.com",
    companyId: "cmp_001",
    companyName: "Testing Company",
    type: "EMAIL_CHANGE",
    payload: { newEmail: "novo.email@example.com" },
    status: "PENDING",
    createdAt: new Date().toISOString(),
  },
];

export function listUserRequests(userId: string, filters?: { status?: RequestStatus; type?: RequestType }) {
  return REQUESTS.filter(
    (req) =>
      req.userId === userId &&
      (!filters?.status || req.status === filters.status) &&
      (!filters?.type || req.type === filters.type)
  );
}

export function listAllRequests(filters?: {
  status?: RequestStatus;
  type?: RequestType;
  companyId?: string;
  sort?: "createdAt_desc" | "createdAt_asc";
}) {
  let results = [...REQUESTS];
  if (filters?.status) results = results.filter((r) => r.status === filters.status);
  if (filters?.type) results = results.filter((r) => r.type === filters.type);
  if (filters?.companyId) results = results.filter((r) => r.companyId === filters.companyId);
  if (filters?.sort === "createdAt_asc") {
    results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else {
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return results;
}

export function addRequest(user: SessionUser, type: RequestType, payload: Record<string, unknown>) {
  const duplicate = REQUESTS.find((r) => r.userId === user.id && r.type === type && r.status === "PENDING");
  if (duplicate) {
    const err = new Error("Duplicated pending request");
    (err as any).code = "DUPLICATE";
    throw err;
  }

  const record: RequestRecord = {
    id: randomUUID(),
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    companyId: user.companyId,
    companyName: user.companyName,
    type,
    payload,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  REQUESTS.push(record);
  return record;
}

export function updateRequestStatus(
  id: string,
  status: Exclude<RequestStatus, "PENDING">,
  reviewer: SessionUser,
  reviewNote?: string
) {
  const req = REQUESTS.find((r) => r.id === id);
  if (!req) return null;
  if (req.status !== "PENDING") return req;
  req.status = status;
  req.reviewedBy = reviewer.id;
  req.reviewNote = reviewNote;
  req.reviewedAt = new Date().toISOString();
  return req;
}
