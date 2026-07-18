import { listAccessRequests, getAccessRequestById } from "../../../database/repositories/accessRequestsStore";

jest.mock("../../../database/persistenceMode", () => ({
  shouldUsePostgresPersistence: () => false,
}));
jest.mock("../../../lib/storeMode", () => ({
  shouldUseJsonStore: () => false,
}));
jest.mock("../../../lib/redis", () => ({
  isRedisConfigured: () => false,
  getRedis: () => null,
}));

describe("accessRequestsStore", () => {
  it("should list access requests (empty initially if mock/memory)", async () => {
    const list = await listAccessRequests();
    expect(list).toBeInstanceOf(Array);
  });
});

