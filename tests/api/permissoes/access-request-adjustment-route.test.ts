jest.mock("@/backend/rbac/requireAccessRequestReviewer", () => ({
  requireAccessRequestReviewerWithStatus: jest.fn(),
}));
jest.mock("@/backend/access-requests/reviewAccess", () => ({
  canReviewerAccessQueue: jest.fn(),
  resolveAccessRequestQueue: jest.fn(() => "global_only"),
}));
jest.mock("@/backend/storeMode", () => ({ shouldUseJsonStore: jest.fn() }));
jest.mock("@/backend/access-requests/repository", () => ({ getAccessRequestV2ById: jest.fn() }));
jest.mock("@/backend/access-requests/service", () => ({ transitionAccessRequest: jest.fn() }));
jest.mock("@/data/access-requests/store", () => ({
  getAccessRequestById: jest.fn(),
  updateAccessRequest: jest.fn(),
}));
jest.mock("@/data/access-requests/commentsStore", () => ({ createAccessRequestComment: jest.fn() }));
jest.mock("@/data/auditLogRepository", () => ({ addAuditLogSafe: jest.fn() }));
jest.mock("@/backend/notificationService", () => ({ notifyAccessRequestAdjustmentRequested: jest.fn(() => Promise.resolve()) }));
jest.mock("@/database/prismaClient", () => ({
  prisma: { supportRequest: { findUnique: jest.fn(), update: jest.fn() } },
}));

import { POST } from "@/api/admin/access-requests/[id]/request-adjustment/route";
import { requireAccessRequestReviewerWithStatus } from "@/backend/rbac/requireAccessRequestReviewer";
import { canReviewerAccessQueue } from "@/backend/access-requests/reviewAccess";
import { shouldUseJsonStore } from "@/backend/storeMode";
import { getAccessRequestV2ById } from "@/backend/access-requests/repository";
import { getAccessRequestById, updateAccessRequest } from "@/data/access-requests/store";
import { createAccessRequestComment } from "@/data/access-requests/commentsStore";
import { prisma } from "@/database/prismaClient";
import { composeAccessRequestMessage } from "@/backend/access-requests/message";

const mockedRequireReviewer = requireAccessRequestReviewerWithStatus as jest.MockedFunction<typeof requireAccessRequestReviewerWithStatus>;
const mockedCanReviewerAccessQueue = canReviewerAccessQueue as jest.MockedFunction<typeof canReviewerAccessQueue>;
const mockedShouldUseJsonStore = shouldUseJsonStore as jest.MockedFunction<typeof shouldUseJsonStore>;
const mockedGetAccessRequestV2ById = getAccessRequestV2ById as jest.MockedFunction<typeof getAccessRequestV2ById>;
const mockedGetAccessRequestById = getAccessRequestById as jest.MockedFunction<typeof getAccessRequestById>;
const mockedUpdateAccessRequest = updateAccessRequest as jest.MockedFunction<typeof updateAccessRequest>;
const mockedCreateComment = createAccessRequestComment as jest.MockedFunction<typeof createAccessRequestComment>;
const mockedPrismaSupportRequest = prisma.supportRequest as unknown as { findUnique: jest.Mock; update: jest.Mock };

const seedMessage = composeAccessRequestMessage({
  email: "solicitante@example.com",
  name: "Solicitante",
  fullName: "Solicitante Completo",
  profileType: "empresa",
});

const admin = { id: "admin-1", email: "admin@example.com", role: "leader_tc", globalRole: null, isGlobalAdmin: false, companyId: null, companySlug: null };

function routeParams() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function makeRequest(body: unknown) {
  return new Request("https://app.local/api/admin/access-requests/request-1/request-adjustment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

const validBody = { comment: "Faltou anexar o comprovante", fields: ["document"] };

describe("app/api/admin/access-requests/[id]/request-adjustment/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAccessRequestV2ById.mockResolvedValue(null);
    mockedCanReviewerAccessQueue.mockReturnValue(true);
  });

  it("retorna 401/403 quando requireAccessRequestReviewerWithStatus nega acesso", async () => {
    mockedRequireReviewer.mockResolvedValue({ admin: null, status: 401 });
    const res = await POST(makeRequest(validBody), routeParams());
    expect(res.status).toBe(401);
  });

  it("retorna 400 quando não há comentário", async () => {
    mockedRequireReviewer.mockResolvedValue({ admin, status: 200 } as never);
    const res = await POST(makeRequest({ fields: ["document"] }), routeParams());
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando não há campos selecionados", async () => {
    mockedRequireReviewer.mockResolvedValue({ admin, status: 200 } as never);
    const res = await POST(makeRequest({ comment: "Ajuste" }), routeParams());
    expect(res.status).toBe(400);
  });

  describe("caminho JSON store", () => {
    beforeEach(() => {
      mockedShouldUseJsonStore.mockReturnValue(true);
      mockedRequireReviewer.mockResolvedValue({ admin, status: 200 } as never);
    });

    it("retorna 404 quando a solicitação não existe", async () => {
      mockedGetAccessRequestById.mockResolvedValue(null);
      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(404);
    });

    it("retorna 403 quando o revisor não tem acesso à fila da solicitação", async () => {
      mockedGetAccessRequestById.mockResolvedValue({ id: "request-1", email: "solicitante@example.com", message: seedMessage, status: "in_progress" } as never);
      mockedCanReviewerAccessQueue.mockReturnValue(false);
      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(403);
    });

    it("retorna 409 quando a solicitação já está em status final", async () => {
      mockedGetAccessRequestById.mockResolvedValue({ id: "request-1", email: "solicitante@example.com", message: seedMessage, status: "closed" } as never);
      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(409);
    });

    it("aplica o ajuste com sucesso (200) e registra comentário + histórico de ajuste na mensagem", async () => {
      mockedGetAccessRequestById.mockResolvedValue({ id: "request-1", email: "solicitante@example.com", message: seedMessage, status: "in_progress" } as never);
      mockedUpdateAccessRequest.mockResolvedValue({ id: "request-1", status: "in_progress" } as never);

      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, item: { id: "request-1", status: "in_progress" } });

      expect(mockedUpdateAccessRequest).toHaveBeenCalledWith(
        "request-1",
        expect.objectContaining({ status: "in_progress", message: expect.stringContaining("document") }),
      );
      expect(mockedCreateComment).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "request-1", body: "Faltou anexar o comprovante" }),
      );
    });
  });

  describe("caminho Prisma (com fallback pro JSON store)", () => {
    beforeEach(() => {
      mockedShouldUseJsonStore.mockReturnValue(false);
      mockedRequireReviewer.mockResolvedValue({ admin, status: 200 } as never);
    });

    it("aplica o ajuste via Prisma com sucesso (200)", async () => {
      mockedPrismaSupportRequest.findUnique.mockResolvedValue({ id: "request-1", email: "solicitante@example.com", message: seedMessage, status: "in_progress" });
      mockedPrismaSupportRequest.update.mockResolvedValue({ id: "request-1", status: "in_progress" });

      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(200);
      expect(mockedPrismaSupportRequest.update).toHaveBeenCalled();
    });

    it("cai pro JSON store quando o Prisma lança erro, preservando a mesma checagem de elegibilidade", async () => {
      mockedPrismaSupportRequest.findUnique.mockRejectedValue(new Error("conexão perdida"));
      mockedGetAccessRequestById.mockResolvedValue({ id: "request-1", email: "solicitante@example.com", message: seedMessage, status: "closed" } as never);

      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(409);
      expect(mockedGetAccessRequestById).toHaveBeenCalledWith("request-1");
    });
  });
});
