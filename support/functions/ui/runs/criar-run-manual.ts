import { expect, type Page } from "@playwright/test";

import { slugifyRelease as slugifyRun } from "../../../../lib/slugifyRelease";
import { EMPRESA_CLIENTE_E2E, rotaDetalheRunEmpresa } from "./rotas-runs";

export type DadosRunManual = {
  titulo: string;
  pass?: number;
  fail?: number;
  blocked?: number;
  notRun?: number;
};

export function slugificarTituloRun(titulo: string) {
  return slugifyRun(titulo.replace(/^run\s+/i, ""));
}

export async function criarRunManualPelaTela(
  page: Page,
  dados: DadosRunManual,
  companySlug = EMPRESA_CLIENTE_E2E.slug,
) {
  const slug = slugificarTituloRun(dados.titulo);

  await page.request
    .get(`/api/releases-manual?clientSlug=${encodeURIComponent(companySlug)}&kind=run`)
    .catch(() => null);

  await expect(page.getByTestId("test-run-repository")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("run-create").click();

  const modal = page.getByTestId("test-run-create-modal");
  await expect(modal).toBeVisible({ timeout: 10000 });
  await modal.getByTestId("test-run-title-input").first().fill(dados.titulo);
  await modal.getByTestId("run-stat-pass").fill(String(dados.pass ?? 80));
  await modal.getByTestId("run-stat-fail").fill(String(dados.fail ?? 10));
  await modal.getByTestId("run-stat-blocked").fill(String(dados.blocked ?? 0));
  await modal.getByTestId("run-stat-not-run").fill(String(dados.notRun ?? 0));

  const respostaCriacao = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/releases-manual" && response.request().method() === "POST";
    },
    { timeout: 45000 },
  );
  await modal.getByTestId("run-submit").last().click();
  const response = await respostaCriacao;
  if (!response.ok()) {
    throw new Error(`Falha ao criar run manual: HTTP ${response.status()} ${await response.text().catch(() => "")}`);
  }
  const payload = (await response.json().catch(() => null)) as { slug?: string } | null;
  const slugCriado = payload?.slug ?? slug;
  const caminhosCriados = [
    `/empresas/${companySlug}/runs/${slugCriado}`,
    `/${companySlug}/runs/${slugCriado}`,
  ];

  const esperarDetalhe = () =>
    page.waitForURL(
      (url) => caminhosCriados.includes(url.pathname),
      { timeout: 15000, waitUntil: "domcontentloaded" },
    );

  await esperarDetalhe().catch(async () => {
    await page.goto(rotaDetalheRunEmpresa(slugCriado, companySlug), { waitUntil: "domcontentloaded" });
    await esperarDetalhe();
  });

  return {
    slug: slugCriado,
    url: rotaDetalheRunEmpresa(slugCriado, companySlug),
  };
}
