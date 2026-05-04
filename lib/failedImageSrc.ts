"use client";

const failedImageSrcs = new Set<string>();

function normalizeImageSrc(src?: string | null) {
  if (typeof src !== "string") return "";
  return src.trim();
}

export function hasFailedImageSrc(src?: string | null) {
  const normalized = normalizeImageSrc(src);
  return normalized ? failedImageSrcs.has(normalized) : false;
}

export function markFailedImageSrc(src?: string | null) {
  const normalized = normalizeImageSrc(src);
  if (!normalized) return false;
  const existed = failedImageSrcs.has(normalized);
  failedImageSrcs.add(normalized);
  return !existed;
}
