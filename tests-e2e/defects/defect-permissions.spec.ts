import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("defeitos - permissões", () => {
  test("user não vê botão de edição de defeito manual", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    await expect(page.getByTestId("defect-edit")).toBeHidden();
  });

  test("admin acessa página de defeitos", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["griaule", "testing-company"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    await expect(page.getByTestId("defects-page")).toBeVisible();
    await expect(page.getByTestId("defects-list")).toBeVisible();
  });
});
