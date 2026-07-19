/**
 * Regressão do IDOR encontrado em ProjectsStore.update (modo Postgres):
 * o update buscava o projeto só por id, sem checar a empresa dona, e ainda
 * permitia sobrescrever o companyId via payload — um usuário autenticado em
 * uma empresa podia editar ou "transferir" projetos de outra empresa só
 * conhecendo o id. Este teste força o caminho Postgres (mockado) e prova que
 * o update agora exige id + companyId batendo, e nunca aceita companyId vindo
 * de `updates`.
 */

const ORIGINAL_AUTH_STORE = process.env.AUTH_STORE;

afterEach(() => {
  if (ORIGINAL_AUTH_STORE === undefined) delete process.env.AUTH_STORE;
  else process.env.AUTH_STORE = ORIGINAL_AUTH_STORE;
  jest.resetModules();
});

async function loadProjectsStoreWithMockedPrisma(prismaMock: {
  findFirst: jest.Mock;
  update: jest.Mock;
}) {
  jest.resetModules();
  process.env.AUTH_STORE = "postgres";

  jest.doMock("@/database/prismaClient", () => ({
    prisma: {
      supportProject: {
        findFirst: prismaMock.findFirst,
        update: prismaMock.update,
      },
    },
  }));

  const mod = await import("@/backend/projects/projectsStore");
  return mod.ProjectsStore;
}

describe("ProjectsStore.update — escopo por empresa (regressão IDOR)", () => {
  it("nao atualiza projeto de outra empresa mesmo conhecendo o id", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const update = jest.fn();
    const ProjectsStore = await loadProjectsStoreWithMockedPrisma({ findFirst, update });

    const result = await ProjectsStore.update("project-da-empresa-b", "empresa-a", {
      title: "Renomeado pelo atacante",
    });

    expect(result).toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "project-da-empresa-b", companyId: "empresa-a" },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("atualiza normalmente quando o projeto pertence a propria empresa", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "p1", companyId: "empresa-a" });
    const update = jest.fn().mockResolvedValue({
      id: "p1",
      code: null,
      title: "Novo titulo",
      description: null,
      companyId: "empresa-a",
      createdBy: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const ProjectsStore = await loadProjectsStoreWithMockedPrisma({ findFirst, update });

    const result = await ProjectsStore.update("p1", "empresa-a", { title: "Novo titulo" });

    expect(result?.title).toBe("Novo titulo");
    expect(result?.companyId).toBe("empresa-a");
    expect(update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { title: "Novo titulo" },
    });
  });

  it("ignora companyId enviado dentro de updates - nao deixa transferir o projeto entre empresas", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "p1", companyId: "empresa-a" });
    const update = jest.fn().mockResolvedValue({
      id: "p1",
      code: null,
      title: "Titulo",
      description: null,
      companyId: "empresa-a",
      createdBy: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const ProjectsStore = await loadProjectsStoreWithMockedPrisma({ findFirst, update });

    await ProjectsStore.update("p1", "empresa-a", {
      title: "Titulo",
      // um payload malicioso tentando reatribuir o projeto para outra empresa
      companyId: "empresa-b",
    } as Parameters<typeof ProjectsStore.update>[2]);

    const dataSentToPrisma = update.mock.calls[0]?.[0]?.data;
    expect(dataSentToPrisma).not.toHaveProperty("companyId");
  });
});
