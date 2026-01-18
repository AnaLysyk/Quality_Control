import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user vê histórico da empresa ativa", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/historico", { waitUntil: "networkidle" });

  await expect(page.getByTestId("audit-page")).toBeVisible();
  await expect(page.getByTestId("audit-timeline")).toBeVisible();
});