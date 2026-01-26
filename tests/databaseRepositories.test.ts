import { listClients, getClientById, createClient, updateClient } from "@/data/clientsRepository";
import { getUserById, getUserByEmail, listUsers, updateUserAvatar } from "@/data/usersRepository";
import { getUserRoleInClient, listUsersByClient, addUserToClient } from "@/data/userClientsRepository";

jest.mock("@/lib/vercelPostgres", () => {
  const sqlMock = jest.fn();
  return {
    getPostgresSql: jest.fn(() => sqlMock),
    requirePostgresSql: jest.fn(() => sqlMock),
    __sqlMock: sqlMock,
  };
});

const { __sqlMock } = jest.requireMock("@/lib/vercelPostgres") as { __sqlMock: jest.Mock };
const sqlMock = __sqlMock as jest.Mock;

beforeEach(() => {
  sqlMock.mockReset();
});

describe("clientsRepository", () => {
  it("lista clientes ordenados e retorna linhas do banco", async () => {
    sqlMock.mockResolvedValue({ rows: [{ id: "c1", name: "Cliente 1" }] });

    const clientes = await listClients();

    expect(sqlMock).toHaveBeenCalledTimes(1);
    expect(sqlMock.mock.calls[0][0][0]).toContain("select * from clients");
    expect(clientes[0]).toMatchObject({ id: "c1", name: "Cliente 1" });
  });

  it("busca cliente por id e devolve null quando nǜo existe", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const cliente = await getClientById("cli-inexistente");

    expect(sqlMock.mock.calls[0][1]).toBe("cli-inexistente");
    expect(cliente).toBeNull();
  });

  it("cria cliente com os campos obrigatÇürios", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "c2", name: "Cliente 2", slug: "cliente-2" }] });

    const novo = await createClient({ name: "Cliente 2", slug: "cliente-2", description: "Desc", logo_url: null });

    expect(sqlMock.mock.calls[0][1]).toBe("Cliente 2");
    expect(sqlMock.mock.calls[0][2]).toBe("cliente-2");
    expect(sqlMock.mock.calls[0][3]).toBeNull();
    expect(sqlMock.mock.calls[0][4]).toBe("Desc");
    expect(novo).toMatchObject({ id: "c2", name: "Cliente 2", slug: "cliente-2" });
  });

  it("atualiza cliente e retorna null quando nenhuma linha ǜ alterada", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const atualizado = await updateClient("cli-3", { name: "Atualizado", active: true });

    expect(sqlMock.mock.calls[0][1]).toBe("Atualizado");
    expect(sqlMock.mock.calls[0][5]).toBe(true);
    expect(sqlMock.mock.calls[0][6]).toBe("cli-3");
    expect(atualizado).toBeNull();
  });

  it("retorna o registro atualizado quando o banco confirma a alteraçÇüo", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "cli-3", name: "Atualizado", active: true }] });

    const atualizado = await updateClient("cli-3", { name: "Atualizado", active: true });

    expect(atualizado).toMatchObject({ id: "cli-3", name: "Atualizado", active: true });
  });
});

describe("usersRepository", () => {
  it("retorna usuǭrio por id", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "u1", email: "a@b.com" }] });

    const usuario = await getUserById("u1");

    expect(sqlMock.mock.calls[0][1]).toBe("u1");
    expect(usuario).toMatchObject({ id: "u1", email: "a@b.com" });
  });

  it("getUserByEmail devolve null quando nǜo encontra", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const usuario = await getUserByEmail("sem@exemplo.com");

    expect(sqlMock.mock.calls[0][1]).toBe("sem@exemplo.com");
    expect(usuario).toBeNull();
  });

  it("lista usuǭrios ordenados", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "u1" }, { id: "u2" }] });

    const usuarios = await listUsers();

    expect(sqlMock.mock.calls[0][0][0]).toContain("select * from users");
    expect(usuarios).toHaveLength(2);
  });

  it("atualiza avatar e devolve o registro retornado", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "u1", avatar_url: "http://img" }] });

    const usuario = await updateUserAvatar("u1", "http://img");

    expect(sqlMock.mock.calls[0][1]).toBe("http://img");
    expect(sqlMock.mock.calls[0][2]).toBe("u1");
    expect(usuario?.avatar_url).toBe("http://img");
  });
});

describe("userClientsRepository", () => {
  it("retorna vinculaçÇüo ativa do usuǭrio no cliente", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "link1", role: "ADMIN" }] });

    const vinculo = await getUserRoleInClient("u1", "c1");

    expect(sqlMock.mock.calls[0][1]).toBe("u1");
    expect(sqlMock.mock.calls[0][2]).toBe("c1");
    expect(vinculo).toMatchObject({ id: "link1", role: "ADMIN" });
  });

  it("lista usuǭrios vinculados a um cliente", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "link1", user_id: "u1" }] });

    const vinculados = await listUsersByClient("c1");

    expect(sqlMock.mock.calls[0][1]).toBe("c1");
    expect(vinculados[0]).toMatchObject({ id: "link1" });
  });

  it("adiciona usuǭrio a um cliente e retorna o registro criado", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "link2", role: "USER" }] });

    const vinculo = await addUserToClient({ userId: "u1", clientId: "c1", role: "USER" });

    expect(sqlMock.mock.calls[0][1]).toBe("u1");
    expect(sqlMock.mock.calls[0][2]).toBe("c1");
    expect(sqlMock.mock.calls[0][3]).toBe("USER");
    expect(vinculo).toMatchObject({ id: "link2", role: "USER" });
  });
});
