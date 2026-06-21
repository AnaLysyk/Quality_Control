import { expect, test } from "../../../support/fixtures/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.describe("Repositorio central de casos de teste", () => {
  test("@case=TC-CASES-001 abre o repositorio central e mostra a tela unica", async ({
    context,
    page,
  }) => {
    await simularAutenticacao(context, {
      role: "leader_tc",
      permissionRole: "leader_tc",
      companyRole: "leader_tc",
      companySlug: "testing-company",
      companySlugs: ["testing-company", "griaule"],
      clientSlug: "testing-company",
      clientSlugs: ["testing-company", "griaule"],
      isGlobalAdmin: true,
    });

    await page.goto("/casos-de-teste");

    await expect(page).toHaveURL(/\/casos-de-teste/);
    await expect(page).not.toHaveURL(/\/automacoes\/casos/);

    const repository = page.getByTestId("test-case-repository");
    await expect(repository).toBeVisible();
    await expect(repository.getByRole("heading", { name: "Casos de Teste" })).toBeVisible();
    await expect(repository.getByText(/Repositório Central/i)).toBeVisible();
    await expect(repository.getByRole("button", { name: "Novo caso de teste" })).toBeVisible();
    await expect(repository.getByLabel("Origem")).toBeVisible();
    await expect(repository.getByLabel("Status")).toBeVisible();
    await expect(repository.getByLabel("Automação")).toBeVisible();
  });
});
