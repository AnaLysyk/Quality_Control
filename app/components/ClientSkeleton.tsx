"use client";

export function ClientSkeleton({ message }: { message?: string }) {
  return (
    <div className="p-4 space-y-3">
      <div className="h-4 w-40 animate-pulse rounded bg-[--tc-skeleton-bg]" />
      <div className="h-6 w-24 animate-pulse rounded bg-[--tc-skeleton-bg]" />
      <div className="h-4 w-52 animate-pulse rounded bg-[--tc-skeleton-bg]" />
      {message && <div className="text-xs text-[--tc-skeleton-text]">{message}</div>}
    </div>
  );
}
