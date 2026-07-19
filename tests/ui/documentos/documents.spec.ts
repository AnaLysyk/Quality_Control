import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";

async function addLink(page: import("@playwright/test").Page, title: string, url: string) {
  await page.getByRole("button", { name: /Adicionar link/i }).click();
  await page.getByTestId("doc-link-title").fill(title);
  await page.getByTestId("doc-link-url").fill(url);
  await page.getByTestId("doc-link-submit").click();
  await expect(page.getByText("Link adicionado com sucesso.")).toBeVisible();
}

test("documentos - company anexa arquivo e salva link", async ({ page, context }) => {
  await simularAutenticacao(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });

  await page.goto("/empresas/demo/documentos", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /Adicionar arquivo/i }).click();
  await page.getByTestId("doc-file-title").fill("Manual QA");
  await page.getByTestId("doc-file-description").fill("Documento de teste");
  await page.getByTestId("doc-file-input").setInputFiles({
    name: "manual.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Conteudo do manual QA"),
  });
  await page.getByTestId("doc-file-submit").click();

  await expect(page.getByText("Arquivo adicionado com sucesso.")).toBeVisible();
  await expect(page.getByTestId("document-list")).toContainText("Manual QA");

  await addLink(page, "Checklist Deploy", "https://example.com/docs");
  await expect(page.getByTestId("document-list")).toContainText("Checklist Deploy");
});

test("documentos - admin acessa outras empresas e company nao", async ({ page, context }) => {
  await simularAutenticacao(context, { role: "admin", companies: ["DEMO", "testing-company"], clientSlug: "DEMO" });

  await page.goto("/empresas/testing-company/documentos", { waitUntil: "domcontentloaded" });
  await addLink(page, "Doc Testing Company", "https://example.com/testing");
  await expect(page.getByTestId("document-list")).toContainText("Doc Testing Company");

  await simularAutenticacao(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });
  await page.goto("/empresas/testing-company/documentos", { waitUntil: "domcontentloaded" });

  const deniedCount = await page.locator("text=Acesso negado").count();
  if (deniedCount === 0) {
    const listCount = await page.locator('[data-testid="document-list"]').count();
    if (listCount > 0) {
      await expect(page.getByTestId("document-list")).not.toContainText("Doc Testing Company");
    }
  } else {
    await expect(page.getByText("Acesso negado")).toBeVisible();
  }
});

