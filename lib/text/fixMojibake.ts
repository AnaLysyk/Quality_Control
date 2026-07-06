export function fixMojibake(value: string) {
  return value
    .replaceAll("VocÃª", "Você")
    .replaceAll("TÃ­tulo", "Título")
    .replaceAll("ligaÃ§Ã£o", "ligação")
    .replaceAll("LigaÃ§Ã£o", "Ligação")
    .replaceAll("DuraÃ§Ã£o", "Duração")
    .replaceAll("descriÃ§Ã£o", "descrição")
    .replaceAll("DescriÃ§Ã£o", "Descrição")
    .replaceAll("nÃ£o", "não")
    .replaceAll("NÃ£o", "Não")
    .replaceAll("possÃ­vel", "possível")
    .replaceAll("usuÃ¡rio", "usuário")
    .replaceAll("UsuÃ¡rio", "Usuário")
    .replaceAll("estÃ¡", "está")
    .replaceAll("tÃ©cnico", "técnico")
    .replaceAll("tÃ©cnica", "técnica")
    .replaceAll("avanÃ§o", "avanço")
    .replaceAll("AtenÃ§Ã£o", "Atenção")
    .replaceAll("ReaÃ§Ã£o", "Reação")
    .replaceAll("revisÃ£o", "revisão")
    .replaceAll("anÃ¡lise", "análise")
    .replaceAll("LÃ­der", "Líder")
    .replaceAll("â€¢", "•")
    .replaceAll("âœ…", "✅")
    .replaceAll("âš ï¸", "⚠️")
    .replaceAll("â¤ï¸", "❤️")
    .replaceAll("ðŸ‘", "👍")
    .replaceAll("ðŸ‘€", "👀")
    .replaceAll("ðŸ”¥", "🔥")
    .replaceAll("ðŸŽ‰", "🎉")
    .replaceAll("ðŸž", "🐞")
    .replaceAll("ðŸ¤”", "🤔")
    .replaceAll("ðŸ™Œ", "🙌");
}

export function fixMojibakeDeep<T>(value: T): T {
  if (typeof value === "string") return fixMojibake(value) as T;
  if (Array.isArray(value)) return value.map((item) => fixMojibakeDeep(item)) as T;
  if (!value || typeof value !== "object") return value;

  const fixed: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    fixed[key] = fixMojibakeDeep(entry);
  }
  return fixed as T;
}
