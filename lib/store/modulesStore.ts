import { getJson, setJson } from "../store/redisClient";
import { PERMISSION_MODULES } from "@/lib/permissionCatalog";

const MODULES_KEY = "qc:modules_catalog";

export const DEFAULT_MODULES = PERMISSION_MODULES;

export async function getModulesCatalog() {
  const value = await getJson(MODULES_KEY);
  if (value) return value;
  await setJson(MODULES_KEY, DEFAULT_MODULES);
  return DEFAULT_MODULES;
}

export async function seedModulesIfMissing() {
  const value = await getJson(MODULES_KEY);
  if (!value) {
    await setJson(MODULES_KEY, DEFAULT_MODULES);
  }
}
