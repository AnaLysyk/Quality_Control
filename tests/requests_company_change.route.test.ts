import { POST } from "@/api/requests/company-change/route";

jest.mock("@/lib/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/data/requestsStore", () => ({
  addRequest: jest.fn(),
}));

const addRequest = jest.requireMock("@/data/requestsStore").addRequest as jest.Mock;
const authenticateRequest = jest.requireMock("@/lib/jwtAuth").authenticateRequest as jest.Mock;

describe("/api/requests/company-change POST", () => {
  beforeEach(() => {
    authenticateRequest.mockReset();
    addRequest.mockReset();
  });

  it("retorna 400 se newCompanyName faltando", async () => {
    authenticateRequest.mockResolvedValue({ id: "u1", email: "u1@example.com", isGlobalAdmin: false });
    const res = await POST(
      new Request("http://localhost/api/requests/company-change", { method: "POST", body: JSON.stringify({}) })
    );
    expect(res.status).toBe(400);
  });

  it("retorna 201 se criado", async () => {
    authenticateRequest.mockResolvedValue({ id: "u1", email: "u1@example.com", isGlobalAdmin: false });
    addRequest.mockReturnValue({ id: "req1" });
    const res = await POST(
      new Request("http://localhost/api/requests/company-change", {
        method: "POST",
        body: JSON.stringify({ newCompanyName: "Nova" }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("retorna 409 se duplicata", async () => {
    authenticateRequest.mockResolvedValue({ id: "u1", email: "u1@example.com", isGlobalAdmin: false });
    const err = new Error("dup") as Error & { code?: string };
    err.code = "DUPLICATE";
    addRequest.mockImplementation(() => {
      throw err;
    });
    const res = await POST(
      new Request("http://localhost/api/requests/company-change", {
        method: "POST",
        body: JSON.stringify({ newCompanyName: "Nova" }),
      })
    );
    expect(res.status).toBe(409);
  });
});
