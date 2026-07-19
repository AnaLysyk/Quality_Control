/**
 * Regressão do gap encontrado: várias telas fora de app/admin/** (ex.:
 * /casos-de-teste, /planos-de-teste, /brain, /chat) renderizavam a página
 * inteira (200) para requisições sem sessão nenhuma, porque a permissão só
 * era checada no client (hooks) ou na API chamada depois — nunca antes de
 * montar a página. requireScreenAccess() fecha isso: é chamado a partir do
 * layout.tsx (Server Component) de cada rota, antes de `children` renderizar.
 */

class FakeRedirect extends Error {
  constructor(public readonly destination: string) {
    super(`NEXT_REDIRECT:${destination}`);
  }
}

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: (name: string) => (name === "x-current-path" ? "/casos-de-teste" : name === "host" ? "app.local" : null),
  })),
  cookies: jest.fn(async () => ({ getAll: () => [] })),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn((destination: string) => {
    throw new FakeRedirect(destination);
  }),
}));

jest.mock("@/backend/auth/session", () => ({ getAccessContext: jest.fn() }));
jest.mock("@/backend/serverPermissionAccess", () => ({ resolvePermissionAccessForUser: jest.fn() }));

import { getAccessContext } from "@/backend/auth/session";
import { resolvePermissionAccessForUser } from "@/backend/serverPermissionAccess";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

const mockGetAccessContext = getAccessContext as jest.Mock;
const mockResolvePermissionAccessForUser = resolvePermissionAccessForUser as jest.Mock;

describe("requireScreenAccess — guarda server-side de tela", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("redireciona para /login quando não há sessão (sem renderizar a tela)", async () => {
    mockGetAccessContext.mockResolvedValue(null);

    await expect(requireScreenAccess("test_repository", "read", { loginNext: "/casos-de-teste" })).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fcasos-de-teste",
    );

    expect(mockResolvePermissionAccessForUser).not.toHaveBeenCalled();
  });

  it("redireciona para fora da tela quando a sessão existe mas falta a permissão", async () => {
    mockGetAccessContext.mockResolvedValue({
      userId: "user-1",
      companySlug: "empresa-a",
      companySlugs: ["empresa-a"],
    });
    mockResolvePermissionAccessForUser.mockResolvedValue({ permissions: { test_repository: [] } });

    await expect(requireScreenAccess("test_repository", "read")).rejects.toThrow(
      "NEXT_REDIRECT:/empresas/empresa-a/home",
    );
  });

  it("não redireciona quando a sessão tem a permissão exigida", async () => {
    mockGetAccessContext.mockResolvedValue({
      userId: "user-1",
      companySlug: "empresa-a",
      companySlugs: ["empresa-a"],
    });
    mockResolvePermissionAccessForUser.mockResolvedValue({
      permissions: { test_repository: ["read"] },
    });

    const access = await requireScreenAccess("test_repository", "read");
    expect(access?.userId).toBe("user-1");
  });
});
