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
          const sameSubject =
            typeof params.subject === "string"
              ? item.subject.includes(params.subject)
              : params.subject.test(item.subject);

          return sameTo && sameSubject;
        }) ?? null;
      },
      {
        timeout: 10000,
        message: `Esperando e-mail capturado para ${params.to}`,
      },
    )
    .not.toBeNull();

  const found = listarEmailsCapturados().find((item) => {
    const sameTo = item.to.toLowerCase() === params.to.toLowerCase();
    const sameSubject =
      typeof params.subject === "string"
        ? item.subject.includes(params.subject)
        : params.subject.test(item.subject);

    return sameTo && sameSubject;
  });

  expect(found).toBeTruthy();

  for (const expected of params.contains ?? []) {
    expect(`${found?.subject}\n${found?.text}\n${found?.html}`).toContain(expected);
  }

  return found!;
}
