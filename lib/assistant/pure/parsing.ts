export type AssistantTicketReference =
  | { type: "code"; code: string; numeric: number }
  | { type: "id"; id: string }
  | { type: "numeric"; numeric: number; code: string };

export function extractTicketReference(text: string): AssistantTicketReference | null {
  const codeMatch = text.match(/\bSP[-\s]?0*(\d{1,8})\b/i);
  if (codeMatch?.[1]) {
    const numeric = Number(codeMatch[1]);
    if (Number.isFinite(numeric)) {
      return {
        type: "code",
        code: `SP-${String(numeric).padStart(6, "0")}`,
        numeric,
      };
    }
  }

  const uuidMatch = text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  if (uuidMatch?.[0]) {
    return { type: "id", id: uuidMatch[0].toLowerCase() };
  }

  const numericMatch = text.match(/\b(\d{2,8})\b/);
  if (numericMatch?.[1]) {
    const numeric = Number(numericMatch[1]);
    if (Number.isFinite(numeric)) {
      return {
        type: "numeric",
        numeric,
        code: `SP-${String(numeric).padStart(6, "0")}`,
      };
    }
  }

  return null;
}
