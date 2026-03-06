"use client";

export function AuthSkeleton({ message }: { message?: string }) {
  return (
    <div
      className="p-4 space-y-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="h-4 w-32 rounded bg-(--tc-surface-2) border border-(--tc-border)/30" />
        <div className="h-10 w-10 rounded-full bg-(--tc-surface-2) border border-(--tc-border)/30" />
        <div className="h-4 w-56 rounded bg-(--tc-surface-2) border border-(--tc-border)/30" />
      </div>
      {message && <div className="text-xs text-(--tc-text-muted)">{message}</div>}
    </div>
  );
}
