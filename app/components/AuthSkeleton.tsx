"use client";

export function AuthSkeleton({ message }: { message?: string }) {
  return (
    <div className="p-4 space-y-3">
      <div className="h-4 w-32 animate-pulse rounded bg-[--tc-skeleton-bg]" />
      <div className="h-10 w-10 animate-pulse rounded-full bg-[--tc-skeleton-bg]" />
      <div className="h-4 w-56 animate-pulse rounded bg-[--tc-skeleton-bg]" />
      {message && <div className="text-xs text-[--tc-skeleton-text]">{message}</div>}
    </div>
  );
}
