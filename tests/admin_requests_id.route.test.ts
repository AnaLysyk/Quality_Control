import { PATCH } from "@/api/admin/requests/[id]/route";

jest.mock("@/lib/session", () => ({
  getSessionUser: jest.fn(),
}));

jest.mock("@/data/requestsStore", () => ({
  updateRequestStatus: jest.fn(),
}));

jest.mock("@/data/usersStore", () => ({
  updateUserEmail: jest.fn(),
  updateUserCompany: jest.fn(),
}));

const getSessionUser = jest.requireMock("@/lib/session").getSessionUser as jest.Mock;
const updateRequestStatus = jest.requireMock("@/data/requestsStore").updateRequestStatus as jest.Mock;
const updateUserEmail = jest.requireMock("@/data/usersStore").updateUserEmail as jest.Mock;
const updateUserCompany = jest.requireMock("@/data/usersStore").updateUserCompany as jest.Mock;

describe("/api/admin/requests/[id] PATCH", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    updateRequestStatus.mockReset();
    updateUserEmail.mockReset();
    updateUserCompany.mockReset();
  });

  it("retorna 403 se não admin", async () => {
    getSessionUser.mockReturnValue({ role: "user" });
    const res = await PATCH(new Request("http://localhost/api/admin/requests/1", { method: "PATCH" }), { params: { id: "1" } });
    expect(res.status).toBe(403);
  });

  it("retorna 400 se status inválido", async () => {
    getSessionUser.mockReturnValue({ role: "admin" });
    const res = await PATCH(
      new Request("http://localhost/api/admin/requests/1", { method: "PATCH", body: JSON.stringify({ status: "X" }) }),
      { params: { id: "1" } }
    );
    expect(res.status).toBe(400);
  });

  it("retorna 404 se request não encontrada", async () => {
    getSessionUser.mockReturnValue({ role: "admin" });
    updateRequestStatus.mockReturnValue(null);
    const res = await PATCH(
      new Request("http://localhost/api/admin/requests/1", { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) }),
      { params: { id: "1" } }
    );
    expect(res.status).toBe(404);
  });

  it("chama efeitos colaterais ao aprovar EMAIL_CHANGE", async () => {
    getSessionUser.mockReturnValue({ role: "admin", id: "admin1" });
    updateRequestStatus.mockReturnValue({
      id: "req1",
      type: "EMAIL_CHANGE",
      payload: { newEmail: "novo@x" },
      status: "PENDING",
      userId: "user1",
    });
    const res = await PATCH(
      new Request("http://localhost/api/admin/requests/1", { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) }),
      { params: { id: "1" } }
    );
    expect(res.status).toBe(200);
    expect(updateUserEmail).toHaveBeenCalledWith("user1", "novo@x");
  });

  it("chama efeitos colaterais ao aprovar COMPANY_CHANGE", async () => {
    getSessionUser.mockReturnValue({ role: "admin", id: "admin1" });
    updateRequestStatus.mockReturnValue({
      id: "req2",
      type: "COMPANY_CHANGE",
      payload: { newCompanyName: "Nova" },
      status: "PENDING",
      userId: "user1",
    });
    const res = await PATCH(
      new Request("http://localhost/api/admin/requests/2", { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) }),
      { params: { id: "2" } }
    );
    expect(res.status).toBe(200);
    expect(updateUserCompany).toHaveBeenCalledWith("user1", "Nova");
  });
});
