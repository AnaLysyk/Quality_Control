import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import path from "path";
import { expect } from "@playwright/test";

export type CapturedEmail = {
  at: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
};

export function criarEmailTeste(prefix = "access-request") {
  const base = process.env.E2E_MAILBOX_BASE || "paulalysyk1234@gmail.com";
  const [name, domain] = base.split("@");
  return `${name}+${prefix}.${Date.now()}@${domain}`;
}

export function emailCaptureFile() {
  return process.env.EMAIL_CAPTURE_FILE || path.join("test-results", "emails", "access-request-outbox.jsonl");
}

export function limparEmailsCapturados() {
  const file = emailCaptureFile();
  mkdirSync(path.dirname(file), { recursive: true });
  rmSync(file, { force: true });
}

export function listarEmailsCapturados(): CapturedEmail[] {
  const file = emailCaptureFile();
  if (!existsSync(file)) return [];

  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CapturedEmail);
}

export async function esperarEmailCapturado(params: {
  to: string;
  subject: string | RegExp;
  contains?: string[];
}) {
  const email = await expect
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
