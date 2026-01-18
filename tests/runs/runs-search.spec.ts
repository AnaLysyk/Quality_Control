import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user filtra runs pela busca", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
  });

  await page.goto("/runs", { waitUntil: "networkidle" });

  await page.getByTestId("runs-search").fill("Sprint");
  await expect(page.getByTestId("runs-list")).toBeVisible();
});