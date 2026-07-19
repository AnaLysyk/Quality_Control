jest.mock("@/backend/brain/access", () => ({
  resolveBrainAccess: jest.fn(),
}));

jest.mock("@/backend/brain/contracts", () => ({
  isAllowedBrainEvent: jest.fn(),
}));

jest.mock("@/backend/brain", () => ({
  upsertNode: jest.fn(),
  connectNodes: jest.fn(),
  addMemory: jest.fn(),
}));

jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainAuditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" }),
    },
  },
}));

import { POST } from "@/api/brain/graph/ingest/route";
import { resolveBrainAccess } from "@/backend/brain/access";
import { isAllowedBrainEvent } from "@/backend/brain/contracts";
import { addMemory, connectNodes, upsertNode } from "@/backend/brain";

function makeRequest(body: object) {
  return new Request("http://localhost/api/brain/graph/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("brain ingest contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveBrainAccess as jest.Mock).mockResolvedValue({
      ok: true,
      context: { user: { id: "u-manage" } },
    });
    (isAllowedBrainEvent as jest.Mock).mockReturnValue(true);
    (upsertNode as jest.Mock).mockResolvedValue({ id: "node-1" });
    (connectNodes as jest.Mock).mockResolvedValue({ id: "edge-1" });
    (addMemory as jest.Mock).mockResolvedValue({ id: "mem-1" });
  });

  it("rejects event type outside allowed contract", async () => {
    (isAllowedBrainEvent as jest.Mock).mockReturnValue(false);

    const response = await POST(
      makeRequest({
        eventType: "invalid.event",
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/fora do contrato/i);
  });

  it("accepts custom event and ingests node, edge and memory", async () => {
    (isAllowedBrainEvent as jest.Mock).mockReturnValue(false);

    const response = await POST(
      makeRequest({
        eventType: "custom.case.created",
        source: "api",
        companySlug: "testing-company",
        node: {
          type: "TestCase",
          label: "TC-1042",
          refType: "TestCase",
          refId: "tc-1042",
        },
        edge: {
          fromId: "node-1",
          toId: "node-2",
          type: "LINKED_TO",
        },
        memory: {
          title: "Decisao de automacao",
          summary: "Caso deve ter automacao guiada",
          memoryType: "DECISION",
        },
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.status).toBe("ingested");
    expect(upsertNode).toHaveBeenCalledTimes(1);
    expect(connectNodes).toHaveBeenCalledTimes(1);
    expect(addMemory).toHaveBeenCalledTimes(1);
  });
});

