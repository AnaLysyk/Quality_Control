import "server-only";

import { getRedis } from "@/lib/redis";

export async function getJson(key: string) {
  const raw = await getRedis().get<string>(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function setJson(key: string, value: unknown) {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  await getRedis().set(key, payload);
  return true;
}

export async function deleteKey(key: string) {
  await getRedis().del(key);
  return true;
}
