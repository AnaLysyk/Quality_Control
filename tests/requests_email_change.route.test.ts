import { POST } from "@/api/requests/email-change/route";

jest.mock("@/lib/session", () => ({
  getSessionUser: jest.fn(),
}));

jest.mock("@/data/requestsStore", () => ({
  addRequest: jest.fn(),
}));

const getSessionUser = jest.requireMock("@/lib/session").getSessionUser as jest.Mock;
const addRequest = jest.requireMock("@/data/requestsStore").addRequest as jest.Mock;

describe("/api/requests/email-change POST", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    addRequest.mockReset();
  });

  it("retorna 400 se newEmail faltando", async () => {
    getSessionUser.mockResolvedValue({ id: "u1" });
    const res = await POST(new Request("http://localhost/api/requests/email-change", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("retorna 201 se criado", async () => {
    getSessionUser.mockResolvedValue({ id: "u1" });
    addRequest.mockReturnValue({ id: "req1" });
    const res = await POST(
      new Request("http://localhost/api/requests/email-change", {
        method: "POST",
        body: JSON.stringify({ newEmail: "novo@example.com" }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("retorna 409 se duplicata", async () => {
    getSessionUser.mockResolvedValue({ id: "u1" });
    const err = new Error("dup") as Error & { code?: string };
    err.code = "DUPLICATE";
    addRequest.mockImplementation(() => {
      throw err;
    });
    const res = await POST(
      new Request("http://localhost/api/requests/email-change", {
        method: "POST",
        body: JSON.stringify({ newEmail: "novo@example.com" }),
      })
    );
    expect(res.status).toBe(409);
  });
});
