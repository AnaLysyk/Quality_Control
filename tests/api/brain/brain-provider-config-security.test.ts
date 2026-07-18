const mockFindMany = jest.fn();
const mockUpsert = jest.fn();

jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainProviderConfig: {
      findMany: mockFindMany,
      upsert: mockUpsert,
    },
  },
}));

jest.mock("@/backend/brain/access", () => ({
  resolveBrainAccess: jest.fn(),
}));

import type { NextRequest } from "next/server";

import { GET, PATCH } from "@/api/admin/brain/provider-config/route";
import { resolveBrainAccess } from "@/backend/brain/access";

const envBackup = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
};

function adminContext() {
  return {
    user: { id: "admin-1", email: "admin@testing.local", isGlobalAdmin: true },
    userAccess: { permissions: { brain: ["configure_sources"] } },
    hasGlobalVisibility: true,
    canManage: true,
    allowedCompanySlugs: new Set<string>(),
    allowedCompanyIds: new Set<string>(),
    allowedProjectIds: new Set<string>(),
  };
}

function readOnlyContext() {
  return {
    user: { id: "user-1", email: "user@testing.local", isGlobalAdmin: false },
    userAccess: { permissions: { brain: ["view"] } },
    hasGlobalVisibility: false,
    canManage: false,
    allowedCompanySlugs: new Set(["testing-company"]),
    allowedCompanyIds: new Set(["company-1"]),
    allowedProjectIds: new Set<string>(),
  };
}

function request(body?: object) {
  return new Request("http://localhost/api/admin/brain/provider-config", {
    method: body ? "PATCH" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest;
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (!value || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
    key.toLowerCase().replace(/[^a-z0-9]/g, ""),
    ...collectKeys(item),
  ]);
}

describe("brain provider config admin security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockUpsert.mockResolvedValue({});
    (resolveBrainAccess as jest.Mock).mockResolvedValue({ ok: true, context: adminContext() });
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("GET nao retorna tokens, apenas status booleano das chaves", async () => {
    process.env.GROQ_API_KEY = "groq-secret-value";
    process.env.GEMINI_API_KEY = "gemini-secret-value";
    process.env.OPENROUTER_API_KEY = "openrouter-secret-value";

    const response = await GET(request());
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.keyStatus.groq).toEqual({ configured: true });
    expect(payload.keyStatus.gemini).toEqual({ configured: true });
    expect(payload.keyStatus.openrouter).toEqual({ configured: true });
    expect(serialized).not.toContain("groq-secret-value");
    expect(serialized).not.toContain("gemini-secret-value");
    expect(serialized).not.toContain("openrouter-secret-value");
    expect(collectKeys(payload)).not.toEqual(
      expect.arrayContaining(["apikey", "token", "secret", "password", "credential", "key"]),
    );
  });

  it.each(["apiKey", "token", "secret", "password", "key"])(
    "PATCH rejeita payload contendo %s",
    async (fieldName) => {
      const response = await PATCH(request({
        provider: "groq",
        enabled: true,
        [fieldName]: "valor-proibido",
      }));
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toBe("Tokens devem ser configurados apenas no ambiente seguro do servidor.");
      expect(mockUpsert).not.toHaveBeenCalled();
    },
  );

  it("usuario sem permissao nao consegue alterar", async () => {
    (resolveBrainAccess as jest.Mock).mockResolvedValue({ ok: true, context: readOnlyContext() });

    const response = await PATCH(request({
      provider: "groq",
      enabled: false,
    }));

    expect(response.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
