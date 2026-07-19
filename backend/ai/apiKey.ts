import "server-only";

export function getAiApiKey() {
  const key =
    process.env.OPENAI_API_KEY ??
    process.env.AI_API_KEY ??
    process.env.OPENAI_KEY ??
    "";
  const trimmed = key.trim();
  return trimmed || null;
}

export function requireAiApiKey() {
  const key = getAiApiKey();
  if (!key) {
    throw new Error("Missing AI API key. Set OPENAI_API_KEY (recommended) or AI_API_KEY.");
  }
  return key;
}


