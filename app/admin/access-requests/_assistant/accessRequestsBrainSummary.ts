import { normalizeAccessRequestsBrainText } from "./accessRequestsBrainParser";
import type { AccessRequestsBrainVisibleRow } from "./accessRequestsBrain.types";

function firstName(user: unknown) {
  const record = (user ?? {}) as { name?: string | null; fullName?: string | null; email?: string | null };
  return (record.fullName || record.name || record.email || "Ana").split(/\s+/)[0] || "Ana";
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = value || "NÃ£o informado";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function formatCounter(counter: Record<string, number>) {
  return Object.entries(counter).map(([key, value]) => `${key}: ${value}`).join(", ");
}

export function readAccessRequestsBrainRows(): AccessRequestsBrainVisibleRow[] {
  if (typeof document === "undefined") return [];
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-brain-row="access-request"]'))
    .filter((row) => row.offsetParent !== null);

  return rows.map((row, index) => ({
    index: index + 1,
    id: row.dataset.brainId ?? "",
    name: row.dataset.brainName ?? "Solicitante",
    email: row.dataset.brainEmail ?? "",
    status: row.dataset.brainStatus ?? "Status nÃ£o informado",
    statusValue: (row.dataset.brainStatusValue ?? "") as AccessRequestsBrainVisibleRow["statusValue"],
    profile: row.dataset.brainProfile ?? "Perfil nÃ£o informado",
    company: row.dataset.brainCompany ?? "NÃ£o informada",
    changes: Number(row.dataset.brainChanges ?? "0") || 0,
  }));
}

export function findAccessRequestsBrainRow(term: string, rows = readAccessRequestsBrainRows()) {
  const normalizedTerm = normalizeAccessRequestsBrainText(term);
  if (!normalizedTerm || /\bprimeir\w*\b/.test(normalizedTerm)) return rows[0] ?? null;
  const tokens = normalizedTerm.split(" ").filter(Boolean);
  return rows.find((row) => {
    const haystack = normalizeAccessRequestsBrainText([
      row.name,
      row.email,
      row.profile,
      row.company,
      row.status,
    ].join(" "));
    return tokens.every((token) => haystack.includes(token));
  }) ?? null;
}

export function suggestAccessRequestsBrainTerm(term: string, rows = readAccessRequestsBrainRows()) {
  const normalizedTerm = normalizeAccessRequestsBrainText(term);
  if (!normalizedTerm || rows.length === 0) return null;
  const words = rows.flatMap((row) => [row.name, row.email, row.profile, row.company].join(" ").split(/\s+/));
  const unique = Array.from(new Set(words.map((word) => word.replace(/[^\p{L}\p{N}@._-]/gu, "")).filter((word) => word.length >= 4)));
  const score = (candidate: string) => {
    const value = normalizeAccessRequestsBrainText(candidate);
    if (value.includes(normalizedTerm) || normalizedTerm.includes(value)) return 0;
    let distance = Math.abs(value.length - normalizedTerm.length);
    const length = Math.min(value.length, normalizedTerm.length);
    for (let index = 0; index < length; index += 1) {
      if (value[index] !== normalizedTerm[index]) distance += 1;
    }
    return distance;
  };
  const best = unique.map((word) => ({ word, score: score(word) })).sort((a, b) => a.score - b.score)[0];
  return best && best.score <= 3 ? best.word : null;
}

export function buildAccessRequestsBrainSummary(actionText: string, user: unknown, rows = readAccessRequestsBrainRows()) {
  const name = firstName(user);
  if (rows.length === 0) {
    return [
      `Oi, tudo bem, ${name}?`,
      "",
      `Realizei uma busca aqui pra vocÃª: ${actionText}.`,
      "",
      "Olha aqui no painel de solicitaÃ§Ãµes: nÃ£o encontrei nenhum resultado visÃ­vel com esse filtro agora.",
      "",
      "Minha leitura:",
      "- Pode ser que a busca esteja com algum termo errado ou que os filtros combinados estejam restringindo demais.",
      "- Tenta limpar filtros ou buscar sÃ³ pelo nome/perfil principal.",
    ].join("\n");
  }

  const statusCounter = countBy(rows.map((row) => row.status));
  const profileCounter = countBy(rows.map((row) => row.profile));
  const withoutCompany = rows.filter((row) => /nÃ£o informada|nao informada|nÃ£o informado|nao informado/i.test(row.company)).length;
  const withChanges = rows.filter((row) => row.changes > 0).length;
  const examples = rows.slice(0, 5).map((row) => `- ${row.name}${row.email ? ` â€” ${row.email}` : ""}: ${row.status}, perfil ${row.profile}, empresa ${row.company}.`);
  const attention = [
    withoutCompany > 0 ? `${withoutCompany} solicitaÃ§Ã£o(Ãµes) sem empresa informada.` : "",
    withChanges > 0 ? `${withChanges} solicitaÃ§Ã£o(Ãµes) com alteraÃ§Ã£o marcada.` : "",
    rows.some((row) => /rejeitad|recusad/i.test(row.status)) ? "Existem solicitaÃ§Ãµes recusadas/rejeitadas; para elas o melhor Ã© consultar histÃ³rico ou PDF." : "",
    rows.some((row) => /abert|nova/i.test(row.status)) ? "Existem solicitaÃ§Ãµes abertas; boas para testar aprovar, recusar e pedir ajuste." : "",
  ].filter(Boolean);

  return [
    `Oi, tudo bem, ${name}?`,
    "",
    `Realizei uma busca aqui pra vocÃª: ${actionText}.`,
    "",
    `Olha aqui no painel de solicitaÃ§Ãµes: encontrei ${rows.length} resultado(s) visÃ­veis agora.`,
    "",
    `Status encontrados: ${formatCounter(statusCounter)}.`,
    `Perfis encontrados: ${formatCounter(profileCounter)}.`,
    "",
    "O que eu encontrei:",
    ...examples,
    "",
    "Minha leitura:",
    ...(attention.length ? attention.map((item) => `- ${item}`) : ["- A listagem estÃ¡ coerente para seguir com a conferÃªncia."]),
    "",
    "PrÃ³ximo passo: abra uma solicitaÃ§Ã£o visÃ­vel para conferir dados, histÃ³rico, ajustes e PDF.",
  ].join("\n");
}


