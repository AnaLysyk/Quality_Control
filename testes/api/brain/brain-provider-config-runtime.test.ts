const mockFindMany = jest.fn();

jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainProviderConfig: {
      findMany: mockFindMany,
      upsert: jest.fn(),
    },
  },
}));

import {
  getBrainProviderRuntimeConfig,
  resolveBrainProviderModels,
  resolveBrainProviderOrder,
} from "@/backend/brain/providerConfig";
import { runBrainModel } from "@/backend/brain/modelProvider";

const envBackup = {
  BRAIN_FREE_PROVIDER_ORDER: process.env.BRAIN_FREE_PROVIDER_ORDER,
  BRAIN_STRICT_FREE_MODELS: process.env.BRAIN_STRICT_FREE_MODELS,
  BRAIN_ONLINE_PROVIDER_TIMEOUT_MS: process.env.BRAIN_ONLINE_PROVIDER_TIMEOUT_MS,
  BRAIN_MAX_OUTPUT_TOKENS: process.env.BRAIN_MAX_OUTPUT_TOKENS,
  GROQ_MODEL: process.env.GROQ_MODEL,
  GROQ_MODELS: process.env.GROQ_MODELS,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_MODELS: process.env.GEMINI_MODELS,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_MODELS: process.env.OPENROUTER_MODELS,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("brain provider config runtime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("config ausente mantem fallback por env", async () => {
    process.env.BRAIN_FREE_PROVIDER_ORDER = "gemini,groq,openrouter";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.GEMINI_MODELS = "gemini-2.5-flash,gemini-1.5-flash";
    process.env.BRAIN_ONLINE_PROVIDER_TIMEOUT_MS = "4500";
    process.env.BRAIN_MAX_OUTPUT_TOKENS = "700";

    const runtime = await getBrainProviderRuntimeConfig();
    const geminiModels = await resolveBrainProviderModels("gemini");

    expect(runtime.order).toEqual(["gemini", "groq", "openrouter"]);
    expect(geminiModels).toEqual(expect.arrayContaining(["gemini-2.5-flash", "gemini-1.5-flash"]));
    expect(runtime.configs.find((config) => config.provider === "gemini")).toMatchObject({
      timeoutMs: 4500,
      maxOutputTokens: 700,
    });
  });

  it("provider desativado nao entra na ordem de execucao", async () => {
    mockFindMany.mockResolvedValue([
      { provider: "groq", enabled: false, priority: 1, strictFreeModels: true, models: ["llama-3.1-8b-instant"] },
      { provider: "gemini", enabled: true, priority: 2, strictFreeModels: true, models: ["gemini-2.5-flash"] },
      { provider: "openrouter", enabled: true, priority: 3, strictFreeModels: true, models: ["openrouter/free"] },
    ]);

    await expect(resolveBrainProviderOrder()).resolves.toEqual(["gemini", "openrouter"]);
  });

  it("fallback mock continua funcionando quando nao ha chave disponivel", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.BRAIN_FREE_PROVIDER_ORDER = "groq,gemini,openrouter";

    const result = await runBrainModel({
      messages: [{ role: "user", content: "Explique o status do Brain" }],
      maxTokens: 300,
    });

    expect(result.provider).toBe("mock");
    expect(result.model).toBe("brain-internal-rag-template");
    expect(result.text).toContain("Brain respondeu com o template interno.");

    warnSpy.mockRestore();
  });
});
