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
import { transitionAccessRequest } from "@/backend/access-requests/service";
import { getAccessRequestById, updateAccessRequest } from "@/data/access-requests/store";
import { createAccessRequestComment } from "@/data/access-requests/commentsStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { notifyAccessRequestAdjustmentRequested } from "@/backend/notificationService";
import { prisma } from "@/database/prismaClient";
import { composeAccessRequestMessage } from "@/backend/access-requests/message";

const mockedRequireReviewer = requireAccessRequestReviewerWithStatus as jest.MockedFunction<typeof requireAccessRequestReviewerWithStatus>;
const mockedCanReviewerAccessQueue = canReviewerAccessQueue as jest.MockedFunction<typeof canReviewerAccessQueue>;
const mockedShouldUseJsonStore = shouldUseJsonStore as jest.MockedFunction<typeof shouldUseJsonStore>;
const mockedGetAccessRequestV2ById = getAccessRequestV2ById as jest.MockedFunction<typeof getAccessRequestV2ById>;
const mockedTransition = transitionAccessRequest as jest.MockedFunction<typeof transitionAccessRequest>;
const mockedGetAccessRequestById = getAccessRequestById as jest.MockedFunction<typeof getAccessRequestById>;
const mockedUpdateAccessRequest = updateAccessRequest as jest.MockedFunction<typeof updateAccessRequest>;
const mockedCreateComment = createAccessRequestComment as jest.MockedFunction<typeof createAccessRequestComment>;
const mockedAddAuditLog = addAuditLogSafe as jest.MockedFunction<typeof addAuditLogSafe>;
const mockedNotify = notifyAccessRequestAdjustmentRequested as jest.MockedFunction<typeof notifyAccessRequestAdjustmentRequested>;
const mockedPrismaSupportRequest = prisma.supportRequest as unknown as { findUnique: jest.Mock; update: jest.Mock };

const seedMessage = composeAccessRequestMessage({
  email: "solicitante@example.com",
  name: "Solicitante",
  fullName: "Solicitante Completo",
  profileType: "empresa",
});

const admin = {
  id: "admin-1",
  email: "admin@example.com",
  role: "leader_tc",
  globalRole: null,
  isGlobalAdmin: false,
  companyId: null,
  companySlug: null,
};

function routeParams() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function makeRequest(body: unknown, rawBody?: string) {
  return new Request("https://app.local/api/admin/access-requests/request-1/request-adjustment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  }) as unknown as Request;
}

const validBody = {
  comment: "Faltou anexar o comprovante",
  fields: ["document"],
  fieldComments: { document: " Envie um documento legível ", ignored: "não usar" },
};

const existingRequest = {
  id: "request-1",
  email: "solicitante@example.com",
  message: seedMessage,
  status: "in_progress",
};

describe("app/api/admin/access-requests/[id]/request-adjustment/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireReviewer.mockResolvedValue({ admin, status: 200 } as never);
    mockedGetAccessRequestV2ById.mockResolvedValue(null);
    mockedCanReviewerAccessQueue.mockReturnValue(true);
    mockedNotify.mockResolvedValue(undefined as never);
  });

  it("retorna 401 ou 403 quando o revisor é negado", async () => {
    mockedRequireReviewer.mockResolvedValue({ admin: null, status: 401 });
    expect((await POST(makeRequest(validBody), routeParams())).status).toBe(401);

    mockedRequireReviewer.mockResolvedValue({ admin: null, status: 403 });
    expect((await POST(makeRequest(validBody), routeParams())).status).toBe(403);
  });

  it("valida JSON, comentário e campos", async () => {
    expect((await POST(makeRequest({}, "{"), routeParams())).status).toBe(400);
    expect((await POST(makeRequest({ fields: ["document"] }), routeParams())).status).toBe(400);
    expect((await POST(makeRequest({ comment: "Ajuste", fields: [null, "", 42] }), routeParams())).status).toBe(400);
  });

  describe("fluxo V2", () => {
    beforeEach(() => {
      mockedGetAccessRequestV2ById.mockResolvedValue({ id: "request-1", accessKey: "key-1" } as never);
    });

    it.each([
      ["adjustment-details-required", 400],
      ["invalid-transition", 409],
      ["forbidden", 403],
      [null, 404],
    ])("mapeia resultado %s para status %s", async (result, expectedStatus) => {
      mockedTransition.mockResolvedValue(result as never);
      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(expectedStatus);
    });

    it("aplica ajuste V2 com sucesso e encaminha campos sanitizados", async () => {
      mockedTransition.mockResolvedValue({ id: "request-1" } as never);
      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(200);
      expect(mockedTransition).toHaveBeenCalledWith(
        "request-1",
        "request-info",
        expect.objectContaining({ id: "admin-1", role: "leader_tc" }),
        expect.objectContaining({
          comment: "Faltou anexar o comprovante",
          adjustmentFields: ["document"],
          fieldComments: { document: "Envie um documento legível" },
        }),
      );
    });
  });

  describe("JSON store", () => {
    beforeEach(() => {
      mockedShouldUseJsonStore.mockReturnValue(true);
    });

    it("retorna 404 quando a solicitação não existe", async () => {
      mockedGetAccessRequestById.mockResolvedValue(null);
      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(404);
    });

    it("retorna 403 sem acesso à fila e 409 para status final", async () => {
      mockedGetAccessRequestById.mockResolvedValue(existingRequest as never);
      mockedCanReviewerAccessQueue.mockReturnValue(false);
      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(403);

      mockedCanReviewerAccessQueue.mockReturnValue(true);
      mockedGetAccessRequestById.mockResolvedValue({ ...existingRequest, status: "rejected" } as never);
      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(409);
    });

    it("aplica ajuste, cria comentário, notifica e audita", async () => {
      mockedGetAccessRequestById.mockResolvedValue(existingRequest as never);
      mockedUpdateAccessRequest.mockResolvedValue(null);

      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, item: { id: "request-1", status: "in_progress" } });
      expect(mockedUpdateAccessRequest).toHaveBeenCalledWith(
        "request-1",
        expect.objectContaining({ status: "in_progress", message: expect.stringContaining("document") }),
      );
      expect(mockedCreateComment).toHaveBeenCalledWith(expect.objectContaining({ body: "Faltou anexar o comprovante" }));
      expect(mockedNotify).toHaveBeenCalled();
      expect(mockedAddAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "access_request.updated" }));
    });

    it("não falha quando a notificação rejeita", async () => {
      mockedGetAccessRequestById.mockResolvedValue(existingRequest as never);
      mockedUpdateAccessRequest.mockResolvedValue({ id: "request-1", status: "in_progress" } as never);
      mockedNotify.mockRejectedValue(new Error("email indisponível"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(200);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Prisma e fallback", () => {
    beforeEach(() => {
      mockedShouldUseJsonStore.mockReturnValue(false);
    });

    it("retorna 404 quando Prisma não encontra a solicitação", async () => {
      mockedPrismaSupportRequest.findUnique.mockResolvedValue(null);
      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(404);
    });

    it("aplica checagens de fila e status no Prisma", async () => {
      mockedPrismaSupportRequest.findUnique.mockResolvedValue(existingRequest);
      mockedCanReviewerAccessQueue.mockReturnValue(false);
      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(403);

      mockedCanReviewerAccessQueue.mockReturnValue(true);
      mockedPrismaSupportRequest.findUnique.mockResolvedValue({ ...existingRequest, status: "closed" });
      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(409);
    });

    it("aplica o ajuste via Prisma com sucesso", async () => {
      mockedPrismaSupportRequest.findUnique.mockResolvedValue(existingRequest);
      mockedPrismaSupportRequest.update.mockResolvedValue({ id: "request-1", status: "in_progress" });

      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(200);
      expect(mockedPrismaSupportRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "in_progress" }),
      }));
      expect(mockedCreateComment).toHaveBeenCalled();
    });

    it("retorna 404 quando Prisma falha e o fallback JSON não encontra a solicitação", async () => {
      mockedPrismaSupportRequest.findUnique.mockRejectedValue(new Error("conexão perdida"));
      mockedGetAccessRequestById.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

      expect((await POST(makeRequest(validBody), routeParams())).status).toBe(404);
      consoleSpy.mockRestore();
    });

    it("aplica fallback JSON com sucesso", async () => {
      mockedPrismaSupportRequest.findUnique.mockRejectedValue(new Error("conexão perdida"));
      mockedGetAccessRequestById.mockResolvedValue(existingRequest as never);
      mockedUpdateAccessRequest.mockResolvedValue({ id: "request-1", status: "in_progress" } as never);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

      const res = await POST(makeRequest(validBody), routeParams());
      expect(res.status).toBe(200);
      expect(mockedUpdateAccessRequest).toHaveBeenCalled();
      expect(mockedCreateComment).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});