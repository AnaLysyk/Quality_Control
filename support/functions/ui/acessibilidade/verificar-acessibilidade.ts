import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function verificarAcessibilidadeDaPagina(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violacoesGraves = resultado.violations.filter(
    (violacao) => violacao.impact === "critical" || violacao.impact === "serious",
  );
  expect(violacoesGraves, JSON.stringify(violacoesGraves, null, 2)).toEqual([]);
}

