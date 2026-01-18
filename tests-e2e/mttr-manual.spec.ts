import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

const DEFECTS_URL = "/empresas/griaule/defeitos";

test("MTTR é calculado ao fechar defeito manual", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto(DEFECTS_URL, { waitUntil: "networkidle" });

  // cria defeito manual
  await page.getByTestId("defect-title").fill("Defeito MTTR");
  await page.getByTestId("defect-create").click();

  // abre modal
  await page.getByText("Defeito MTTR").click();
  await expect(page.getByTestId("defect-modal")).toBeVisible();

  // fecha defeito
  await page.getByTestId("defect-status-select").selectOption("done");
  await page.getByTestId("defect-save").click();

  // MTTR aparece
  const mttr = page.getByTestId("defect-mttr");
  await expect(mttr).not.toHaveText("—");

  // reload não perde MTTR
  await page.reload();
  await expect(mttr).not.toHaveText("—");
});
