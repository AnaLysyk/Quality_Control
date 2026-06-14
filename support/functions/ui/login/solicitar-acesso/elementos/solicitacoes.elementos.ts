import type { Page } from "@playwright/test";

export function localizarElementosTelaSolicitacoes(page: Page) {
  return {
    titulo: page.getByRole("heading", { name: /Solicitações de acesso/i }),
    busca: page.getByRole("textbox").first(),
    lista: page.getByText(/Solicitações/i).first(),
  };
}
