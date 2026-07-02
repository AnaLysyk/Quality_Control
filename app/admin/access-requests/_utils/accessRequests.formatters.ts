export function normalizeAccessRequestText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : "Não informado";
}

