jest.mock("@/lib/brain/access", () => ({
  resolveBrainAccess: jest.fn(),
}));

jest.mock("@/lib/brain/commandInterpreter", () => ({
  interpretBrainCommand: jest.fn(),
  listBrainCommands: jest.fn().mockReturnValue([]),
  executeBrainCommand: jest.fn(),
}));

import { POST } from "@/api/brain/commands/route";
import { resolveBrainAccess } from "@/lib/brain/access";
import { executeBrainCommand, interpretBrainCommand } from "@/lib/brain/commandInterpreter";

function makeRequest(body: object) {
  return new Request("http://localhost/api/brain/commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("brain commands confirmation contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveBrainAccess as jest.Mock).mockResolvedValue({
      ok: true,
      context: {
        user: { id: "u1" },
      },
    });

    (interpretBrainCommand as jest.Mock).mockReturnValue({
      command: "/reindexar",
      args: ["project", "cidadao-smart"],
      params: {},
    });

    (executeBrainCommand as jest.Mock).mockImplementation(({ confirmed }: { confirmed?: boolean }) => {
      if (!confirmed) {
        return Promise.resolve({
          ok: true,
          requiresConfirmation: true,
          confirmationMessage: "Confirme a reindexacao.",
          actionType: "destructive",
        });
      }

      return Promise.resolve({
        ok: true,
        requiresConfirmation: false,
        actionType: "destructive",
        result: { updated: 10 },
      });
    });
  });

  it("returns confirmation request for high-risk command before execution", async () => {
    const response = await POST(makeRequest({ input: "/reindexar projeto cidadao-smart" }));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.requiresConfirmation).toBe(true);
    expect(payload.confirmationMessage).toMatch(/confirme/i);
  });

  it("executes command after explicit confirmation", async () => {
    const response = await POST(makeRequest({ input: "/reindexar projeto cidadao-smart", confirmed: true }));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.requiresConfirmation).toBe(false);
    expect(payload.result.updated).toBe(10);
    expect(executeBrainCommand).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed: true }),
    );
  });
});

