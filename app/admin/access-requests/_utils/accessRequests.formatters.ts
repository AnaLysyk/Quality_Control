export function normalizeAccessRequestText(value: string | null | undefined) {
  return value?.trim() || "Não informado";
}
