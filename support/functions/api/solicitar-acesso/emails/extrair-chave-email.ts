import { expect } from "@playwright/test";
import { esperarEmailCapturado } from "./capturar-emails";

export function extrairChaveDeStatusDoEmail(corpo: string) {
  const textoNormalizado = corpo
    .replace(/<[^>]+>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFFFD/g, "o")
    .replace(/\s+/g, " ");

  return (
    textoNormalizado.match(/(?:Chave de acesso|Codigo de consulta):?\s*([A-Za-z0-9_-]{8,})/i)?.[1] ??
    corpo.match(/status\?key=([A-Za-z0-9_-]+)/i)?.[1] ??
    corpo.match(/key=([A-Za-z0-9_-]+)/i)?.[1] ??
    null
  );
}

export async function capturarChaveDoEmailSolicitacao(email: string) {
  const emailRecebido = await esperarEmailCapturado({
    to: email,
    subject: /Solicita.*acesso recebida/i,
  });

  const corpo = `${emailRecebido.text ?? ""}\n${emailRecebido.html ?? ""}`;
  const chave = extrairChaveDeStatusDoEmail(corpo);

  expect(chave, "Chave/accessKey deve existir no e-mail capturado").toBeTruthy();

  return chave!;
}
