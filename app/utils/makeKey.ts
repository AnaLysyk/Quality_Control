export function makeKey(
  item: Record<string, any> | null | undefined,
  slugProp = "slug",
  idProp = "id",
  idx?: number,
) {
  const obj = item ?? {};
  const slug = typeof obj[slugProp] === "string" ? obj[slugProp] : undefined;
  const id = typeof obj[idProp] === "string" || typeof obj[idProp] === "number" ? String(obj[idProp]) : undefined;
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : undefined;

  if (id) return `${slug ?? id}:${id}`;
  if (createdAt) return `${slug ?? "item"}:${createdAt}`;
  return `${slug ?? "item"}-${idx ?? 0}`;
}

export default makeKey;
