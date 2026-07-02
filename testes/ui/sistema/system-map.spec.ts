import { expect, test } from "../../../support/fixtures/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";

const TOTAL_ROUTES = SYSTEM_ROUTES.length;
const BRAIN_ROUTES = SYSTEM_ROUTES.filter((route) => route.moduleId === "brain").length;
const LEGACY_ROUTES = SYSTEM_ROUTES.filter((route) => route.status === "legado").length;

test.describe("Mapa do Sistema", () => {
  test.beforeEach(async ({ context }) => {
    await simularAutenticacao(context, {
      role: "leader_tc",
      permissionRole: "leader_tc",
      companyRole: "leader_tc",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
      isGlobalAdmin: true,
    });
  });

  test("lista e filtra mÃ³dulos, rotas e status", async ({ page }) => {
    await page.goto("/admin/sistema/mapa", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Mapa do Sistema" })).toBeVisible();
    await expect(page.getByTestId("nav-management")).toBeVisible();
    await expect(page.getByTestId("nav-logs")).toBeVisible();
    await expect(page.getByText(`Exibindo ${TOTAL_ROUTES} de ${TOTAL_ROUTES} rotas.`)).toBeVisible();

    await page.getByLabel("Buscar no mapa do sistema").fill("/automacoes/ui-studio");
    await expect(page.getByRole("button", { name: "Limpar" })).toBeEnabled();
    await expect(page.getByText(`Exibindo 1 de ${TOTAL_ROUTES} rotas.`)).toBeVisible();
    await expect(page.getByText("UI Studio", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Limpar" }).click();
    await page.getByLabel("Filtrar por mÃ³dulo").selectOption("brain");
    await expect(page.getByText(`Exibindo ${BRAIN_ROUTES} de ${TOTAL_ROUTES} rotas.`)).toBeVisible();

    await page.getByLabel("Filtrar por mÃ³dulo").selectOption("todos");
    await page.getByLabel("Filtrar por status").selectOption("legado");
    await expect(page.getByText(`Exibindo ${LEGACY_ROUTES} de ${TOTAL_ROUTES} rotas.`)).toBeVisible();
    await expect(page.getByText("Perfil legado", { exact: true })).toBeVisible();
  });

  test("remove o menu e mostra acesso negado sem permissions.view", async ({ context, page }) => {
    await context.unroute("**/api/me");
    await context.unroute("**/api/auth/me");
    await context.unroute("**/api/me/clients");
    await simularAutenticacao(context, {
      role: "leader_tc",
      permissionRole: "leader_tc",
      companyRole: "leader_tc",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
      isGlobalAdmin: true,
      permissions: {},
    });

    await page.goto("/admin/sistema/mapa", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Acesso negado" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Mapa do Sistema", { exact: true })).toBeVisible();
    await expect(page.getByText("permissions.view", { exact: true })).toBeVisible();
    await expect(page.getByTestId("nav-management")).toHaveCount(0);
  });
});

