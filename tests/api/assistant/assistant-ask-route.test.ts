/**
 * Unit tests for POST /api/assistente/ask
 */

jest.mock("@/backend/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/backend/permissionMatrix", () => ({
  ...jest.requireActual("@/backend/permissionMatrix"),
  hasPermissionAccess: jest.fn(),
}));

jest.mock("@/backend/brain/internalEngine", () => ({
  InternalBrainEngine: jest.fn().mockImplementation(() => ({
    run: jest.fn(),
  })),
}));

jest.mock("@/backend/brain/orchestrator", () => ({
  logAgentExecution: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/backend/brain/agents", () => ({
  detectAgentMode: jest.fn().mockReturnValue("qa"),
}));

jest.mock("@/backend/assistant/service", () => ({
  runAssistantRequest: jest.fn(),
}));

jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainMemory: {
      create: jest.fn().mockResolvedValue({ id: "m1" }),
    },
    userPermissionOverride: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock("@/backend/brain/brainPrisma", () => ({
  brainPrisma: {
    brainNode: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    brainEdge: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    brainAuditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" }),
    },
  },
}));

import { authenticateRequest } from "@/backend/jwtAuth";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { InternalBrainEngine } from "@/backend/brain/internalEngine";
import { logAgentExecution } from "@/backend/brain/orchestrator";
import { runAssistantRequest } from "@/backend/assistant/service";
import { POST } from "@/api/assistant/ask/route";
import type { AuthUser } from "@/backend/jwtAuth";

function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "ana@test.com",
    name: "Ana",
    role: "admin",
    companySlug: "acme",
    permissions: { tickets: ["create", "read"], ai: ["view", "use"] },
    ...overrides,
  } as AuthUser;
}

function makeRequest(body: object): Request {
  return new Request("http://localhost/api/assistente/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const FULL_CONTEXT = {
  module: "support",
  route: "/admin/support",
  screenLabel: "Kanban",
  screenSummary: "Kanban de suporte.",
  entityType: "screen",
  entityId: null,
  companySlug: "acme",
  suggestedPrompts: [] as string[],
};

const MOCK_REPLY = {
  tool: "get_screen_context",
  reply: "Pronto, aqui está o contexto.",
  actions: [] as unknown[],
  context: FULL_CONTEXT,
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateRequest as jest.Mock).mockResolvedValue(makeAuthUser());
  (hasPermissionAccess as jest.Mock).mockReturnValue(true);
  (runAssistantRequest as jest.Mock).mockResolvedValue(MOCK_REPLY);
});

describe("authentication", () => {
  it("returns 401 when unauthenticated", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest({ message: "oi" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/autenticad/i);
  });

  it("returns 403 when ai.view is denied", async () => {
    (hasPermissionAccess as jest.Mock).mockImplementation(
      (_: unknown, mod: string, act: string) => !(mod === "ai" && act === "view"),
    );
    const res = await POST(makeRequest({ message: "oi" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when ai.use is denied", async () => {
    (hasPermissionAccess as jest.Mock).mockImplementation(
      (_: unknown, mod: string, act: string) => !(mod === "ai" && act === "use"),
    );
    const res = await POST(makeRequest({ message: "oi" }));
    expect(res.status).toBe(403);
  });
});

describe("standard assistant flow", () => {
  it("delegates to runAssistantRequest", async () => {
    const res = await POST(makeRequest({ message: "mostrar contexto" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe(MOCK_REPLY.reply);
    expect(body.tool).toBe(MOCK_REPLY.tool);
    expect(runAssistantRequest).toHaveBeenCalledTimes(1);
  });

  it("passes message and history to runAssistantRequest", async () => {
    const history = [
      { from: "user", text: "buscar SP-100" },
      { from: "assistant", text: "Encontrei." },
    ];
    await POST(makeRequest({ message: "resumir", history }));
    expect(runAssistantRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ message: "resumir", history }),
    );
  });

  it("passes context, actor, and action to runAssistantRequest", async () => {
    const context = { route: "/admin/support" };
    const actor = { userId: "u2", role: "admin", companySlug: "acme" };
    const action = {
      kind: "tool",
      label: "Criar chamado",
      tool: "create_ticket",
      input: { title: "Erro", description: "Falha", type: "bug", priority: "high" },
    };

    await POST(makeRequest({ context, actor, action }));

    expect(runAssistantRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ context, actor, action }),
    );
  });

  it("response always includes tool, reply, and context keys", async () => {
    const res = await POST(makeRequest({ message: "oi" }));
    const body = await res.json();
    expect(body).toHaveProperty("tool");
    expect(body).toHaveProperty("reply");
    expect(body).toHaveProperty("context");
  });

  it("still succeeds when history is empty", async () => {
    const res = await POST(makeRequest({ message: "oi", history: [] }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when runAssistantRequest throws", async () => {
    (runAssistantRequest as jest.Mock).mockRejectedValue(new Error("db crash"));
    const res = await POST(makeRequest({ message: "oi" }));
    expect(res.status).toBe(500);
  });
});

describe("brain-first flow", () => {
  function makeBrainEvents(chunks: string[]) {
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) yield { type: "text-delta" as const, text: chunk };
      },
    };
  }

  beforeEach(() => {
    (InternalBrainEngine as jest.Mock).mockImplementation(() => ({
      run: jest.fn().mockReturnValue(makeBrainEvents(["Resposta ", "do Brain."])),
    }));
  });

  it("uses Brain when brainContext.source is 'brain'", async () => {
    const res = await POST(makeRequest({ message: "analisar nó", brainContext: { source: "brain" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("Resposta do Brain.");
    expect(body.meta?.agentMode).toBe("qa");
  });

  it("uses Brain when brainContext.nodeId is set", async () => {
    const res = await POST(makeRequest({ message: "explicar", brainContext: { nodeId: "node-abc" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta?.nodeId).toBe("node-abc");
  });

  it("uses Brain when brainContext.agentMode is set", async () => {
    const res = await POST(makeRequest({ message: "depurar", brainContext: { agentMode: "debug" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta?.agentMode).toBe("debug");
  });

  it("returns 400 when brainContext is set but message is empty", async () => {
    const res = await POST(makeRequest({ message: "", brainContext: { source: "brain" } }));
    expect(res.status).toBe(400);
  });

  it("returns error reply on Brain error event", async () => {
    (InternalBrainEngine as jest.Mock).mockImplementation(() => ({
      run: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: "error" as const, error: "timeout" };
        },
      }),
    }));
    const res = await POST(makeRequest({ message: "analisar", brainContext: { source: "brain" } }));
    const body = await res.json();
    expect(body.reply).toContain("Erro do agente");
  });

  it("calls logAgentExecution with success:true after brain reply", async () => {
    await POST(makeRequest({ message: "analisar", brainContext: { source: "brain" } }));
    expect(logAgentExecution).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", success: true }));
  });

  it("does NOT call runAssistantRequest for brain-first requests", async () => {
    await POST(makeRequest({ message: "analisar", brainContext: { source: "brain" } }));
    expect(runAssistantRequest).not.toHaveBeenCalled();
  });

  it("meta.durationMs is a non-negative number", async () => {
    const res = await POST(makeRequest({ message: "analisar", brainContext: { source: "brain" } }));
    const body = await res.json();
    expect(typeof body.meta.durationMs).toBe("number");
    expect(body.meta.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("buildMessagesFromHistory", () => {
  beforeEach(() => {
    (InternalBrainEngine as jest.Mock).mockImplementation(() => ({
      run: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: "text-delta" as const, text: "ok" };
        },
      }),
    }));
  });

  it("converts history + message into [user, user] for Brain", async () => {
    await POST(
      makeRequest({
        message: "segundo turno",
        history: [{ from: "user", text: "primeiro turno" }],
        brainContext: { source: "brain" },
      }),
    );
    const engine = (InternalBrainEngine as jest.Mock).mock.results[0].value;
    const { messages } = (engine.run as jest.Mock).mock.calls[0][0];
    expect(messages).toEqual(
      expect.arrayContaining([
        { role: "user", content: "primeiro turno" },
        { role: "user", content: "segundo turno" },
      ]),
    );
  });

  it("prefers direct messages array over history + message", async () => {
    await POST(
      makeRequest({
        message: "ignorar",
        messages: [{ role: "user", content: "mensagem direta" }],
        brainContext: { source: "brain" },
      }),
    );
    const engine = (InternalBrainEngine as jest.Mock).mock.results[0].value;
    const { messages } = (engine.run as jest.Mock).mock.calls[0][0];
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("mensagem direta");
  });

  it("skips empty-content turns from history", async () => {
    await POST(
      makeRequest({
        message: "válida",
        history: [{ from: "user", text: "" }, { from: "assistant", text: "" }],
        brainContext: { source: "brain" },
      }),
    );
    const engine = (InternalBrainEngine as jest.Mock).mock.results[0].value;
    const { messages } = (engine.run as jest.Mock).mock.calls[0][0];
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("válida");
  });

  it("maps from=assistant to role=assistant", async () => {
    await POST(
      makeRequest({
        message: "ok",
        history: [{ from: "assistant", text: "Resposta anterior." }],
        brainContext: { source: "brain" },
      }),
    );
    const engine = (InternalBrainEngine as jest.Mock).mock.results[0].value;
    const { messages } = (engine.run as jest.Mock).mock.calls[0][0];
    const assistantTurn = messages.find((m: { content: string }) => m.content === "Resposta anterior.");
    expect(assistantTurn?.role).toBe("assistant");
  });
});

