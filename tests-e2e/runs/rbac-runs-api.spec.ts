import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("rbac - runs API", () => {
  test("user nao consegue criar run via API", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    const response = await page.request.post("/api/releases", {
      data: { name: "Run Proibida", runId: 9999, app: "sfq" },
    });

    expect(response.status()).toBe(403);
  });

  test("company nao consegue deletar run via API", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    const response = await page.request.delete("/api/releases", {
      data: { slug: "run_proibida" },
    });

    expect(response.status()).toBe(403);
  });
});

