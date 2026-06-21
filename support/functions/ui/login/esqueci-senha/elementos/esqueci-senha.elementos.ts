import type { Page } from "@playwright/test";

export function localizarElementosEsqueciSenha(page: Page) {
  return {
    formulario: page.getByTestId("forgot-password-form"),
    email: page.getByTestId("forgot-password-email-input"),
    enviar: page.getByTestId("forgot-password-submit-button"),
    voltarAoLogin: page.getByRole("link", { name: /voltar|login/i }),
  };
}
