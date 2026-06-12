import { expect } from "@playwright/test";
import { esperarEmailCapturado } from "./capturar-emails";

export function extrairChaveDeStatusDoEmail(corpo: string) {
  return (
    corpo.match(/(?:Chave de acesso|Código de consulta):?\s*([A-Za-z0-9_-]{8,})/i)?.[1] ??
    corpo.match(/status\?key=([A-Za-z0-9_-]+)/i)?.[1] ??
    corpo.match(/key=([A-Za-z0-9_-]+)/i)?.[1] ??
    null
  );
}

export async function capturarChaveDoEmailSolicitacao(email: string) {
  const emailRecebido = await esperarEmailCapturado({
    to: email,
    subject: "Solicitação de acesso recebida",
  });

  const corpo = `${emailRecebido.text ?? ""}\n${emailRecebido.html ?? ""}`;
  const chave = extrairChaveDeStatusDoEmail(corpo);

  expect(chave, "Chave/accessKey deve existir no e-mail capturado").toBeTruthy();

  return chave!;
}
