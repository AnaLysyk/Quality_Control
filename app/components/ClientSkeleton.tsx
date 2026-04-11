"use client";

export function ClientSkeleton({ message }: { message?: string }) {
  return (
    <div className="tc-section space-y-3 rounded-2xl p-4">
      <div className="h-4 w-40 animate-pulse rounded bg-surface2" />
      <div className="h-6 w-24 animate-pulse rounded bg-surface2" />
      <div className="h-4 w-52 animate-pulse rounded bg-surface2" />
      {message && <div className="text-xs text-muted">{message}</div>}
    </div>
  );
}
