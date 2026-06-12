import { listClients } from "../../../data/clientsRepository";

jest.mock("../../../lib/auth/localStore", () => ({
  listLocalCompanies: jest.fn().mockResolvedValue([
    { slug: "client-a", name: "Client A" },
    { slug: "client-b", company_name: "Client B" },
    { slug: "client-c" } // fallback to "Empresa"
  ]),
}));

describe("clientsRepository", () => {
  it("should list and map clients correctly", async () => {
    const clients = await listClients();
    
    expect(clients).toHaveLength(3);
    expect(clients[0]).toEqual({ slug: "client-a", name: "Client A" });
    expect(clients[1]).toEqual({ slug: "client-b", name: "Client B" });
    expect(clients[2]).toEqual({ slug: "client-c", name: "Empresa" });
  });
});
