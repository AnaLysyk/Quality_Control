import type { Page } from "@playwright/test";

export const elementosSolicitarAcesso = {
  botaoAbrirFormulario: "open-request-access-form-button",
  formulario: "request-access-form",
  perfil: "request-access-role-select",
  nome: "request-access-name-input",
  usuario: "request-access-user-input",
  email: "request-access-email-input",
  telefone: "request-access-phone-input",
  cargo: "request-access-job-title-select",
  titulo: "request-access-title-input",
  descricao: "request-access-reason-input",
  senha: "request-access-password-input",
  resultadoConsulta: "access-request-status-result",
  statusConsulta: "access-request-status-label",
  emailConsulta: "access-request-status-email",
  perfilConsulta: "access-request-status-profile",
};

export function localizarElementosSolicitarAcesso(page: Page) {
  return Object.fromEntries(
    Object.entries(elementosSolicitarAcesso).map(([nome, testId]) => [
      nome,
      page.getByTestId(testId),
    ]),
  ) as Record<keyof typeof elementosSolicitarAcesso, ReturnType<Page["getByTestId"]>>;
}

