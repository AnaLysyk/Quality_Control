import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user cria defeito na empresa ativa", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/defeitos", { waitUntil: "networkidle" });

  await page.getByTestId("defect-create").click();
  await page.getByTestId("defect-title").fill("Erro no login");
  await page.getByTestId("defect-save").click();

  await expect(page.getByText("Erro no login")).toBeVisible();
});