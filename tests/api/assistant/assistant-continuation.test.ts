jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainNode: { findUnique: jest.fn() },
    brainMemory: { findMany: jest.fn() },
    brainAuditLog: { findMany: jest.fn() },
  },
}));

jest.mock("@/backend/brain", () => ({
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

import { InternalBrainEngine } from "@/backend/brain/internalEngine";
import { searchNodes } from "@/backend/brain";

async function collectReply(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const engine = new InternalBrainEngine();
  let reply = "";

  for await (const event of engine.run({ messages, screenLabel: "Dashboard" })) {
    if (event.type === "text-delta") reply += event.text;
  }

  return reply;
}

describe("InternalBrainEngine human continuation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("continues previous topic naturally for 'sim'", async () => {
    const reply = await collectReply([
      { role: "user", content: "quero analisar os riscos do release de hoje" },
      { role: "assistant", content: "Claro, posso ajudar." },
      { role: "user", content: "sim" },
    ]);

    expect(reply.toLowerCase()).toContain("continuando sobre");
    expect(reply.toLowerCase()).toContain("riscos do release");
    expect(reply.toLowerCase()).toContain("resumo rápido");
  });

  it("learns previous topic from conversation and explains in humanized flow", async () => {
    const engine = new InternalBrainEngine();
    let reply = "";

    for await (const event of engine.run({
      agentMode: "qa",
      screenLabel: "Painel de Releases",
      messages: [
        { role: "user", content: "quero entender o impacto da taxa de falha por cliente" },
        { role: "assistant", content: "Perfeito, vamos analisar." },
        { role: "user", content: "explica isso no sistema com mais detalhes" },
      ],
    })) {
      if (event.type === "text-delta") reply += event.text;
    }

    const searchNodesMock = searchNodes as jest.Mock;
    expect(searchNodesMock).toHaveBeenCalled();
    const firstCallQuery = String(searchNodesMock.mock.calls[0][0]?.query ?? "");
    expect(firstCallQuery.toLowerCase()).toContain("continuidade da conversa");
    expect(firstCallQuery.toLowerCase()).toContain("taxa de falha por cliente");

    expect(reply.toLowerCase()).toContain("fluxo de conversa");
    expect(reply.toLowerCase()).toContain("vou conectar com o que voce trouxe antes");
  });
});

