import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type EmailCapturado = {
  at?: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
};

const captureFile = path.resolve(
  process.env.EMAIL_CAPTURE_FILE || "test-results/emails/outbox.jsonl",
);
const outputDir = path.resolve("test-results/emails/preview-access-requests");

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

function readEmailCapturados() {
  assert.ok(fs.existsSync(captureFile), `Arquivo de captura nao encontrado: ${captureFile}`);
  const lines = fs
    .readFileSync(captureFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const emails = lines.map((line, index) => {
    const email = JSON.parse(line) as Partial<EmailCapturado>;
    assert.equal(typeof email.to, "string", `Captura ${index + 1} sem destinatario`);
    assert.equal(typeof email.subject, "string", `Captura ${index + 1} sem assunto`);
    assert.equal(typeof email.html, "string", `Captura ${index + 1} sem HTML`);
    return email as EmailCapturado;
  });

  assert.ok(emails.length > 0, "Nenhum e-mail foi capturado");
  return emails;
}

function main() {
  const emails = readEmailCapturados();
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const rows = emails.map((email, index) => {
    const fileName = `${String(index + 1).padStart(3, "0")}-${safeFileName(email.subject) || "email"}.html`;
    fs.writeFileSync(path.join(outputDir, fileName), email.html, "utf8");
    return `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(email.at ?? "")}</td>
      <td>${escapeHtml(email.to)}</td>
      <td>${escapeHtml(email.subject)}</td>
      <td><a href="./${fileName}">Abrir HTML capturado</a></td>
    </tr>`;
  });

  const latest = emails.at(-1)!;
  fs.writeFileSync(path.join(outputDir, "index.html"), latest.html, "utf8");
  assert.equal(
    fs.readFileSync(path.join(outputDir, "index.html"), "utf8"),
    latest.html,
    "O preview principal precisa ser identico ao HTML capturado",
  );

  const catalogHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Emails capturados - solicitacoes de acesso</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f4f6fb;color:#011848;padding:32px}
    table{width:100%;border-collapse:collapse;background:#fff}
    th,td{padding:12px;border:1px solid #d8dfeb;text-align:left}
    th{background:#011848;color:#fff}
    a{color:#ef0001;font-weight:700}
  </style>
</head>
<body>
  <h1>Emails capturados</h1>
  <p>O arquivo <code>index.html</code> contem exatamente o HTML da captura mais recente.</p>
  <table>
    <thead><tr><th>#</th><th>Data</th><th>Destino</th><th>Assunto</th><th>Preview</th></tr></thead>
    <tbody>${rows.join("\n")}</tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "catalog.html"), catalogHtml, "utf8");
  fs.writeFileSync(path.join(outputDir, "emails.json"), JSON.stringify(emails, null, 2), "utf8");

  console.log(`[EMAIL PREVIEW] ${emails.length} captura(s) exportada(s).`);
  console.log(`[EMAIL PREVIEW] Principal: ${path.join(outputDir, "index.html")}`);
}

main();

