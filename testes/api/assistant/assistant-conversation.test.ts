jest.mock("@/lib/prismaClient", () => ({
  prisma: {
    brainNode: {
      findUnique: jest.fn(),
    },
    brainMemory: {
      findMany: jest.fn(),
    },
    brainAuditLog: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/brain", () => ({
  searchNodes: jest.fn(async () => []),
  getNodeMemories: jest.fn(async () => []),
  getSubgraph: jest.fn(async () => ({ nodes: [] })),
  getGraphMetrics: jest.fn(async () => ({
    nodeCount: 0,
    edgeCount: 0,
    memoryCount: 0,
    averageDegree: 0,
    density: 0,
    orphanedNodes: 0,
  })),
}));

import { InternalBrainEngine } from "@/lib/brain/internalEngine";

async function collectReply(message: string, screenLabel = "Dashboard") {
  const engine = new InternalBrainEngine();
  let reply = "";
  const eventTypes: string[] = [];

  for await (const event of engine.run({
    messages: [{ role: "user", content: message }],
    screenLabel,
  })) {
    eventTypes.push(event.type);
    if (event.type === "text-delta") reply += event.text;
  }

  return { reply, eventTypes };
}

describe("InternalBrainEngine conversational mode", () => {
  it("responds casually to greeting without technical blocks", async () => {
    const { reply, eventTypes } = await collectReply("oi");

    expect(reply.toLowerCase()).toContain("o que vocÃª quer resolver agora");
    expect(reply.toLowerCase()).toContain("dashboard");
    expect(reply).not.toContain("###");
    expect(eventTypes.every((t) => t === "text-delta")).toBe(true);
  });

  it("responds naturally to thanks", async () => {
    const { reply } = await collectReply("valeu");

    expect(reply.toLowerCase()).toContain("disponha");
    expect(reply.toLowerCase()).toContain("prÃ³ximo passo");
    expect(reply).not.toContain("###");
  });

  it("asks for objective input on generic help", async () => {
    const { reply } = await collectReply("me ajuda");

    expect(reply.toLowerCase()).toContain("claro");
    expect(reply.toLowerCase()).toContain("uma frase");
    expect(reply).not.toContain("diagnÃ³stico");
  });
});

