import { GET } from "@/api/requests/me/route";

jest.mock("@/lib/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/data/requestsStore", () => ({
  listUserRequests: jest.fn(),
}));

const listUserRequests = jest.requireMock("@/data/requestsStore").listUserRequests as jest.Mock;
const authenticateRequest = jest.requireMock("@/lib/jwtAuth").authenticateRequest as jest.Mock;

describe("/api/requests/me GET", () => {
  beforeEach(() => {
    authenticateRequest.mockReset();
    listUserRequests.mockReset();
  });

  it("retorna lista de requests do usuário", async () => {
    authenticateRequest.mockResolvedValue({ id: "u1", email: "u1@example.com", isGlobalAdmin: false });
    listUserRequests.mockReturnValue([{ id: "r1", userId: "u1" }]);
    const res = await GET(new Request("http://localhost/api/requests/me?status=PENDING&type=EMAIL_CHANGE"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0].id).toBe("r1");
  });
});
