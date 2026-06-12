import { listUserRequests, listAllRequests, getRequestById, addRequest, updateRequestStatus, RequestRecord } from "../../../data/requestsStore";

jest.mock("../../../lib/persistenceMode", () => ({
  shouldUsePostgresPersistence: () => false,
}));
jest.mock("../../../lib/storeMode", () => ({
  shouldUseJsonStore: () => false,
}));
jest.mock("../../../lib/redis", () => ({
  isRedisConfigured: () => false,
  getRedis: () => null,
}));

describe("requestsStore", () => {
  it("should list all requests", async () => {
    const requests = await listAllRequests();
    expect(requests).toBeInstanceOf(Array);
    expect(requests.length).toBeGreaterThanOrEqual(1);
  });

  it("should list user requests", async () => {
    const requests = await listUserRequests("usr_001");
    expect(requests).toBeInstanceOf(Array);
    // Deve conter pelo menos o mock inicial DEFAULT_ITEMS
    expect(requests.some(req => req.userId === "usr_001")).toBeTruthy();
  });

  it("should create a new request", async () => {
    const user = {
      id: "usr_002",
      name: "Teste User",
      email: "teste@example.com",
    };
    
    // Test the real exposed addRequest signature
    if (typeof addRequest === "function") {
      const created = await addRequest(user, "PASSWORD_RESET", { reason: "Esqueci" });
      expect(created).toBeDefined();
      expect(created.userId).toBe("usr_002");
    }
  });

  it("should list requests with filters", async () => {
    const requests = await listAllRequests({ status: "PENDING" });
    expect(requests.every(req => req.status === "PENDING")).toBeTruthy();
  });
});
