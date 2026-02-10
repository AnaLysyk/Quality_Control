import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("documentos - company anexa arquivo e salva link", async ({ page, context }) => {
  await mockAuth(context, { role: "company", companies: ["griaule"], clientSlug: "griaule" });

  await page.goto("/empresas/griaule/documentos", { waitUntil: "domcontentloaded" });

  await page.getByTestId("doc-file-title").fill("Manual QA");
  await page.getByTestId("doc-file-description").fill("Documento de teste");
  await page.getByTestId("doc-file-input").setInputFiles({
    name: "manual.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Conteudo do manual QA"),
  });
  await page.getByTestId("doc-file-submit").click();

  await expect(page.getByText("Documento anexado com sucesso.")).toBeVisible();
  await expect(page.getByTestId("document-list")).toContainText("Manual QA");

  await page.getByTestId("doc-tab-link").click();
  await page.getByTestId("doc-link-title").fill("Checklist Deploy");
  await page.getByTestId("doc-link-description").fill("Link de referencia");
  await page.getByTestId("doc-link-url").fill("https://example.com/docs");
  await page.getByTestId("doc-link-submit").click();

  await expect(page.getByText("Link salvo com sucesso.")).toBeVisible();
  await expect(page.getByTestId("document-list")).toContainText("Checklist Deploy");
});

test("documentos - admin acessa outras empresas e company nao", async ({ page, context }) => {
  await mockAuth(context, { role: "admin", companies: ["griaule", "testing-company"], clientSlug: "griaule" });

  await page.goto("/empresas/testing-company/documentos", { waitUntil: "domcontentloaded" });
  await page.getByTestId("doc-tab-link").click();
  await page.getByTestId("doc-link-title").fill("Doc Testing Company");
  await page.getByTestId("doc-link-url").fill("https://example.com/testing");
  await page.getByTestId("doc-link-submit").click();

  await expect(page.getByText("Link salvo com sucesso.")).toBeVisible();
  await expect(page.getByTestId("document-list")).toContainText("Doc Testing Company");

  await mockAuth(context, { role: "company", companies: ["griaule"], clientSlug: "griaule" });
  await page.goto("/empresas/testing-company/documentos", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Acesso negado")).toBeVisible();
});
