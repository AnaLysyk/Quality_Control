import { randomUUID } from "crypto";

export type RequestUser = {
  id: string;
  name?: string;
  email?: string;
  companyId?: string;
  companyName?: string;
};

export type RequestType = "EMAIL_CHANGE" | "COMPANY_CHANGE" | "PASSWORD_RESET";
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

const REQUESTS: RequestRecord[] = [
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

export function getRequestById(id: string) {
  return REQUESTS.find((req) => req.id === id) ?? null;
}

export function addRequest(user: RequestUser, type: RequestType, payload: Record<string, unknown>) {
  const duplicate = REQUESTS.find((r) => r.userId === user.id && r.type === type && r.status === "PENDING");
  if (duplicate) {
    const err = new Error("Duplicated pending request") as Error & { code?: string };
    err.code = "DUPLICATE";
    throw err;
  }

  const safeEmail = user.email ?? "";
  const safeName = user.name ?? safeEmail ?? "Usuário";
  const safeCompanyId = user.companyId ?? "";
  const safeCompanyName = user.companyName ?? "";

  const record: RequestRecord = {
    id: randomUUID(),
    userId: user.id,
    userName: safeName,
    userEmail: safeEmail,
    companyId: safeCompanyId,
    companyName: safeCompanyName,
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
  reviewer: { id: string },
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
