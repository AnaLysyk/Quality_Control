import type { Page } from "@playwright/test";

export function localizarElementosTelaSolicitacoes(page: Page) {
  return {
    titulo: page.getByRole("heading", { name: /SolicitaÃ§Ãµes de acesso/i }),
    busca: page.getByRole("textbox").first(),
    lista: page.getByText(/SolicitaÃ§Ãµes/i).first(),
  };
}

