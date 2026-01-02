"use client";

export function ClientSkeleton({ message }: { message?: string }) {
  return (
    <div className="p-4 space-y-3">
      <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
      <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-52 animate-pulse rounded bg-gray-200" />
      {message && <div className="text-xs text-gray-500">{message}</div>}
    </div>
  );
}
