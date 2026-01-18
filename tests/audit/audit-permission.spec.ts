import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user não vê histórico de outra empresa", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
  });

  await page.goto("/historico", { waitUntil: "networkidle" });

  await expect(page.getByText("Testing Company")).toBeHidden();
});