import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import path from "path";
import { expect } from "@playwright/test";

export type EmailCapturado = {
  at: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
};

export function criarEmailTeste(prefix = "access-request") {
  const base = process.env.E2E_MAILBOX_BASE || "access-requests@quality-control.test";
  const [name, domain] = base.split("@");
  return `${name}+${prefix}.${Date.now()}@${domain}`;
}

export function obterArquivoCapturaEmails() {
  return process.env.EMAIL_CAPTURE_FILE || path.join("test-results", "emails", "outbox.jsonl");
}

export function limparEmailsCapturados() {
  const file = obterArquivoCapturaEmails();
  mkdirSync(path.dirname(file), { recursive: true });
  rmSync(file, { force: true });
}

function corrigirMojibake(valor: string) {
  try {
    return Buffer.from(valor, "latin1").toString("utf8");
  } catch {
    return valor;
  }
}

function variantesTexto(valor: string | null | undefined) {
  const original = valor ?? "";
  const corrigido = corrigirMojibake(original);

  return Array.from(new Set([original, corrigido]));
}

function correspondeTexto(valor: string, esperado: string | RegExp) {
  const variantes = variantesTexto(valor);

  if (typeof esperado === "string") {
    const esperados = variantesTexto(esperado);
    return variantes.some((texto) =>
      esperados.some((item) => texto.includes(item)),
    );
  }

  return variantes.some((texto) => esperado.test(texto));
}

export function listarEmailsCapturados(): EmailCapturado[] {
  const file = obterArquivoCapturaEmails();
  if (!existsSync(file)) return [];

  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EmailCapturado);
}

export async function esperarEmailCapturado(params: {
  to: string;
  subject: string | RegExp;
  contains?: string[];
}) {
  await expect
    .poll(
      () => {
        const emails = listarEmailsCapturados();

        return emails.find((item) => {
          const sameTo = item.to.toLowerCase() === params.to.toLowerCase();
          const sameSubject = correspondeTexto(item.subject, params.subject);

          return sameTo && sameSubject;
        }) ?? null;
      },
      {
        timeout: 30000,
        message: `Esperando e-mail capturado para ${params.to}`,
      },
    )
    .not.toBeNull();

  const found = listarEmailsCapturados().find((item) => {
    const sameTo = item.to.toLowerCase() === params.to.toLowerCase();
    const sameSubject = correspondeTexto(item.subject, params.subject);

    return sameTo && sameSubject;
  });

  expect(found).toBeTruthy();

  const conteudoEmail = [
    ...variantesTexto(found?.subject),
    ...variantesTexto(found?.text),
    ...variantesTexto(found?.html),
  ].join("\n");

  for (const expected of params.contains ?? []) {
    const esperadoEncontrado = variantesTexto(expected).some((item) =>
      conteudoEmail.includes(item),
    );

    expect(esperadoEncontrado, `Esperando conteúdo no e-mail: ${expected}`).toBe(true);
  }

  return found!;
}
