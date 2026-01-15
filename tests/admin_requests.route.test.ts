import { GET } from "@/api/admin/requests/route";

jest.mock("@/lib/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/data/requestsStore", () => ({
  listAllRequests: jest.fn(),
}));

const listAllRequests = jest.requireMock("@/data/requestsStore").listAllRequests as jest.Mock;
const authenticateRequest = jest.requireMock("@/lib/jwtAuth").authenticateRequest as jest.Mock;

describe("/api/admin/requests GET", () => {
  beforeEach(() => {
    authenticateRequest.mockReset();
    listAllRequests.mockReset();
  });

  it("retorna 403 se não for admin", async () => {
    authenticateRequest.mockResolvedValue({ id: "u1", email: "u1@example.com", isGlobalAdmin: false });
    const res = await GET(new Request("http://localhost/api/admin/requests"));
    expect(res.status).toBe(403);
  });

  it("retorna lista se admin", async () => {
    authenticateRequest.mockResolvedValue({ id: "admin1", email: "admin@example.com", isGlobalAdmin: true });
    listAllRequests.mockReturnValue([{ id: "req1" }, { id: "req2" }]);
    const res = await GET(new Request("http://localhost/api/admin/requests?status=PENDING"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(2);
  });
});
