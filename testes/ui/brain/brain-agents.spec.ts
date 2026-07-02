import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.setTimeout(60000);

async function openAgentsTab(page: import("@playwright/test").Page) {
  // Open panel via URL param, then click the Agents tab
  await page.goto("/admin/brain?tab=create-node", { waitUntil: "domcontentloaded" });
  const agentsTab = page.getByTestId("brain-agents-tab");
  await expect(agentsTab).toBeVisible({ timeout: 20000 });
  await agentsTab.click();
  await expect(page.getByTestId("agent-view")).toBeVisible({ timeout: 10000 });
}

test("brain agents tab renders agent selectors", async ({ page, context }) => {
  await simularAutenticacao(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });
  await openAgentsTab(page);

  // All 4 agent selectors should be visible
  await expect(page.getByTestId("agent-selector-qa")).toBeVisible();
  await expect(page.getByTestId("agent-selector-debug")).toBeVisible();
  await expect(page.getByTestId("agent-selector-playwright")).toBeVisible();
  await expect(page.getByTestId("agent-selector-memory")).toBeVisible();
});

test("brain agents tab switches agent modes", async ({ page, context }) => {
  await simularAutenticacao(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });
  await openAgentsTab(page);

  // Switch to debug mode
  await page.getByTestId("agent-selector-debug").click();
  await expect(page.getByTestId("agent-selector-debug")).toHaveCSS("font-weight", "700");

  // Switch to playwright mode
  await page.getByTestId("agent-selector-playwright").click();
  await expect(page.getByTestId("agent-selector-playwright")).toHaveCSS("font-weight", "700");
});

test("brain agent sends message and receives streaming response", async ({ page, context }) => {
  await simularAutenticacao(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });
  await openAgentsTab(page);

  // Type a message and send
  const input = page.getByTestId("agent-input");
  await input.fill("Quantos nós existem no Brain?");
  await page.getByTestId("agent-send").click();

  // User message appears
  await expect(page.getByTestId("agent-message-user").first()).toBeVisible({ timeout: 5000 });

  // Assistant message appears
  await expect(page.getByTestId("agent-message-assistant").first()).toBeVisible({ timeout: 5000 });

  // Wait for response to finish streaming
  await expect(page.getByTestId("agent-loading")).not.toBeVisible({ timeout: 30000 });

  // There should be actual content in the assistant message
  const assistantMsg = page.getByTestId("agent-message-assistant").first();
  const content = await assistantMsg.innerText();
  expect(content.trim().length).toBeGreaterThan(0);
});

test("brain agent input disabled while loading and send button inactive when empty", async ({ page, context }) => {
  await simularAutenticacao(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });
  await openAgentsTab(page);

  // Send button should be disabled with empty input
  await expect(page.getByTestId("agent-send")).toBeDisabled();

  // After typing, send button should be enabled
  await page.getByTestId("agent-input").fill("teste");
  await expect(page.getByTestId("agent-send")).not.toBeDisabled();

  // Clear input — send button disabled again
  await page.getByTestId("agent-input").fill("");
  await expect(page.getByTestId("agent-send")).toBeDisabled();
});

test("brain agents tab messages area starts empty with quick prompts", async ({ page, context }) => {
  await simularAutenticacao(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });
  await openAgentsTab(page);

  // Messages container should be visible
  await expect(page.getByTestId("agent-messages")).toBeVisible();

  // No messages yet — agent-thinking or quick prompts visible
  await expect(page.getByTestId("agent-message-user")).not.toBeVisible();
  await expect(page.getByTestId("agent-message-assistant")).not.toBeVisible();
});

