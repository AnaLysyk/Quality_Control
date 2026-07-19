jest.mock("@/database/prismaClient", () => ({
  prisma: {},
}));

jest.mock("@/backend/brain", () => ({
  searchNodes: jest.fn(async () => []),
  getNodeMemories: jest.fn(async () => []),
  getNodeWithContext: jest.fn(async () => null),
  getSubgraph: jest.fn(async () => ({ nodes: [], edges: [] })),
  getGraphMetrics: jest.fn(async () => ({
    nodeCount: 0,
    edgeCount: 0,
    memoryCount: 0,
    averageDegree: 0,
    density: 0,
    orphanedNodes: 0,
  })),
  getRelatedMemories: jest.fn(async () => []),
  getNodeAncestors: jest.fn(async () => []),
  getNodeDescendants: jest.fn(async () => []),
  traceImpact: jest.fn(async () => ({ impactedNodes: [], paths: [] })),
  findSimilarNodes: jest.fn(async () => []),
}));

jest.mock("@/backend/brain/agents", () => ({
  detectAgentMode: jest.fn(() => "qa"),
}));

jest.mock("@/shared/random", () => ({
  secureRandomFloat: jest.fn(() => 0.5),
}));

import { InternalBrainEngine, type EngineInput, type StreamEvent } from "@/backend/brain/internalEngine";

async function collect(input: EngineInput) {
  const events: StreamEvent[] = [];
  for await (const event of new InternalBrainEngine().run(input)) events.push(event);
  return {
    events,
    text: events.filter((event): event is Extract<StreamEvent, { type: "text-delta" }> => event.type === "text-delta")
      .map((event) => event.text)
      .join(""),
  };
}

describe("InternalBrainEngine casual coverage", () => {
  it("returns an error for empty input", async () => {
    await expect(collect({ question: "   " })).resolves.toEqual({
      events: [{ type: "error", error: "Mensagem vazia." }],
      text: "",
    });
  });

  it.each([
    ["bom dia", "o que você quer resolver agora"],
    ["obrigada", "disponha"],
    ["me ajuda", "uma frase"],
    ["ok", "me fala o objetivo"],
  ])("handles casual message %s", async (question, expected) => {
    const result = await collect({ question, screenLabel: "Painel QA" });
    expect(result.text.toLowerCase()).toContain(expected);
    expect(result.text).toContain("Painel QA");
    expect(result.events.every((event) => event.type === "text-delta")).toBe(true);
  });

  it("describes agent capabilities without querying the database", async () => {
    const result = await collect({ question: "o que você consegue fazer?" });
    expect(result.text).toContain("**QA:**");
    expect(result.text).toContain("**Debug:**");
    expect(result.text).toContain("**Playwright:**");
    expect(result.text).toContain("**Memory:**");
  });

  it("connects an explanation request to the previous user topic", async () => {
    const result = await collect({
      question: "explica isso",
      screenLabel: "Releases",
      messages: [
        { role: "user", content: "quero analisar a cobertura da release" },
        { role: "assistant", content: "Certo." },
        { role: "user", content: "explica isso" },
      ],
    });
    expect(result.text).toContain("cobertura da release");
    expect(result.text).toContain("arquitetura/fluxo");
    expect(result.text).toContain("Releases");
  });

  it("continues the previous subject for a short confirmation", async () => {
    const result = await collect({
      messages: [
        { role: "user", content: "preciso revisar os riscos do dashboard" },
        { role: "assistant", content: "Posso ajudar." },
        { role: "user", content: "continua" },
      ],
    });
    expect(result.text).toContain("riscos do dashboard");
    expect(result.text).toContain("ação prática");
  });
});
