import { SC_INTEGRATION_COLLECTION } from "@/data/scIntegrationCollection";

describe("SC Integration API v2 collection", () => {
  it("keeps the collection grouped and counted", () => {
    expect(SC_INTEGRATION_COLLECTION.name).toBe("SC Integration API v2");
    expect(SC_INTEGRATION_COLLECTION.totalRequests).toBe(67);
    expect(SC_INTEGRATION_COLLECTION.groups).toHaveLength(11);
    expect(SC_INTEGRATION_COLLECTION.groups.map((group) => group.title)).toEqual(
      expect.arrayContaining(["Tokens", "Processos", "Cardscan", "Cidadão Smart"]),
    );
  });
});
