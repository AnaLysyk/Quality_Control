import "server-only";

import fs from "fs";
import path from "path";
import type { Release } from "@/types/release";

const STORE_PATH = path.join(process.cwd(), "data", "releases-manual.json");

async function ensureStoreFile() {
  await fs.promises.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.promises.access(STORE_PATH, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(STORE_PATH, "[]", "utf8");
  }
}

export async function readManualReleaseStore(): Promise<Release[]> {
  try {
    await ensureStoreFile();
    const raw = await fs.promises.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Release[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function getAllManualReleases(): Promise<Release[]> {
  return readManualReleaseStore();
}
