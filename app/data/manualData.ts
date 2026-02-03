import type { Release } from "@/types/release";
import { readManualReleases } from "@/lib/manualReleaseStore";
export async function readManualReleaseStore(): Promise<Release[]> {
  return readManualReleases();
}

export async function getAllManualReleases(): Promise<Release[]> {
  return readManualReleaseStore();
}
