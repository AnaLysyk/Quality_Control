"use client";

export function AuthSkeleton({ message }: { message?: string }) {
  return (
    <div className="tc-section space-y-3 rounded-2xl p-4">
      <div className="h-4 w-32 animate-pulse rounded bg-surface2" />
      <div className="h-10 w-10 animate-pulse rounded-full bg-surface2" />
      <div className="h-4 w-56 animate-pulse rounded bg-surface2" />
      {message && <div className="text-xs text-muted">{message}</div>}
    </div>
  );
}
