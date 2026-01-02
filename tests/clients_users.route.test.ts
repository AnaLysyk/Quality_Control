import { GET, POST } from "@/api/clients/[id]/users/route";

jest.mock("@/lib/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
  authorizeClientAccess: jest.fn(),
  requireUserRecord: jest.fn(),
  getClientIdFromHeader: jest.fn(),
}));

jest.mock("@/data/clientsRepository", () => ({
  getClientById: jest.fn(),
}));

jest.mock("@/data/userClientsRepository", () => ({
  getUserRoleInClient: jest.fn(),
  addUserToClient: jest.fn(),
}));

jest.mock("@/data/usersRepository", () => ({
  getUserByEmail: jest.fn(),
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const authenticateRequest = jest.requireMock("@/lib/jwtAuth").authenticateRequest as jest.Mock;
const authorizeClientAccess = jest.requireMock("@/lib/jwtAuth").authorizeClientAccess as jest.Mock;
const requireUserRecord = jest.requireMock("@/lib/jwtAuth").requireUserRecord as jest.Mock;
const getClientIdFromHeader = jest.requireMock("@/lib/jwtAuth").getClientIdFromHeader as jest.Mock;
const getClientById = jest.requireMock("@/data/clientsRepository").getClientById as jest.Mock;
const addUserToClient = jest.requireMock("@/data/userClientsRepository").addUserToClient as jest.Mock;
const getUserRoleInClient = jest.requireMock("@/data/userClientsRepository").getUserRoleInClient as jest.Mock;
const getUserByEmail = jest.requireMock("@/data/usersRepository").getUserByEmail as jest.Mock;
const sql = jest.requireMock("@vercel/postgres").sql as jest.Mock;

describe("/api/clients/[id]/users GET/POST", () => {
  beforeEach(() => {
    authenticateRequest.mockReset();
    authorizeClientAccess.mockReset();
    requireUserRecord.mockReset();
    getClientIdFromHeader.mockReset();
    getClientById.mockReset();
    addUserToClient.mockReset();
    getUserRoleInClient.mockReset();
    getUserByEmail.mockReset();
    sql.mockReset();
  });

  it("GET retorna 401 se não autenticado", async () => {
    authenticateRequest.mockResolvedValue(null);
    requireUserRecord.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/clients/cli/users"), { params: { id: "cli" } });
    expect(res.status).toBe(401);
  });

  it("GET retorna 404 se cliente não existe", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: false });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/clients/cli/users"), { params: { id: "cli" } });
    expect(res.status).toBe(404);
  });

  it("GET retorna 403 se authorizeClientAccess falhar", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: false });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue({ id: "cli" });
    authorizeClientAccess.mockRejectedValue(new Error("Forbidden"));
    const res = await GET(new Request("http://localhost/api/clients/cli/users"), { params: { id: "cli" } });
    expect(res.status).toBe(403);
  });

  it("GET retorna lista quando autorizado", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: false });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue({ id: "cli" });
    authorizeClientAccess.mockResolvedValue(undefined);
    sql.mockResolvedValue({ rows: [{ id: "link1", user_id: "u1", name: "Ana", email: "ana@x" }] });

    const res = await GET(new Request("http://localhost/api/clients/cli/users"), { params: { id: "cli" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toMatchObject({ id: "link1", name: "Ana" });
  });

  it("POST retorna 403 se authorizeClientAccess falhar", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: false });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue({ id: "cli" });
    authorizeClientAccess.mockRejectedValue(new Error("Forbidden"));
    const res = await POST(
      new Request("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "ADMIN" }) }),
      { params: { id: "cli" } }
    );
    expect(res.status).toBe(403);
  });

  it("POST retorna 404 se usuário não encontrado", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: true });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue({ id: "cli" });
    authorizeClientAccess.mockResolvedValue(undefined);
    getUserByEmail.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "ADMIN" }) }),
      { params: { id: "cli" } }
    );
    expect(res.status).toBe(404);
  });

  it("POST retorna 400 se email/role ausentes", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: true });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue({ id: "cli" });
    authorizeClientAccess.mockResolvedValue(undefined);
    const res = await POST(
      new Request("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({}) }),
      { params: { id: "cli" } }
    );
    expect(res.status).toBe(400);
  });

  it("POST retorna 409 se usuário já vinculado", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: true });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue({ id: "cli" });
    authorizeClientAccess.mockResolvedValue(undefined);
    getUserByEmail.mockResolvedValue({ id: "u1", email: "a@b" });
    getUserRoleInClient.mockResolvedValue({ role: "USER", active: true });
    const res = await POST(
      new Request("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "USER" }) }),
      { params: { id: "cli" } }
    );
    expect(res.status).toBe(409);
  });

  it("POST vincula usuário e retorna 201 quando autorizado", async () => {
    authenticateRequest.mockResolvedValue({ id: "u", email: "a", isGlobalAdmin: true });
    requireUserRecord.mockResolvedValue({ id: "u", active: true });
    getClientIdFromHeader.mockReturnValue("cli");
    getClientById.mockResolvedValue({ id: "cli" });
    authorizeClientAccess.mockResolvedValue(undefined);
    getUserByEmail.mockResolvedValue({ id: "u1", email: "a@b" });
    addUserToClient.mockResolvedValue({ id: "link1" });
    const res = await POST(
      new Request("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "ADMIN" }) }),
      { params: { id: "cli" } }
    );
    expect(res.status).toBe(201);
  });
});
