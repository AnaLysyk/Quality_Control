import { expect, test } from "./fixtures/test";
import { mockAuth } from "./helpers/mockAuth";

test.describe("Repositorio central de casos de teste", () => {
  test("@case=TC-CASES-001 abre o repositorio e mostra vinculos com planos, runs e Playwright", async ({
    context,
    page,
  }) => {
    await mockAuth(context, { role: "admin" });

    const apiResponse = await context.request.get("/api/test-cases");
    expect(apiResponse.ok()).toBeTruthy();
    const repositoryPayload = (await apiResponse.json()) as { total: number; metrics: { total: number } };
    expect(repositoryPayload.total).toBeGreaterThan(0);
    expect(repositoryPayload.metrics.total).toBe(repositoryPayload.total);

    await page.goto("/casos-de-teste");

    await expect(page).toHaveURL(/\/automacoes\/casos/);

    const repository = page.getByTestId("test-case-repository");
    await expect(repository).toBeVisible();
    await expect(repository.getByRole("heading", { name: "Casos de Teste" })).toBeVisible();
    await expect(repository.getByText(/Repositorio central de casos manuais/i)).toBeVisible();
    await expect(repository.getByText("Com run")).toBeVisible();
    await expect(repository.getByText("Com spec")).toBeVisible();
  });
});
