import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user vê defeitos da empresa ativa", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/defeitos", { waitUntil: "networkidle" });

  await expect(page.getByTestId("defects-page")).toBeVisible();
  await expect(page.getByTestId("defects-list")).toBeVisible();
});