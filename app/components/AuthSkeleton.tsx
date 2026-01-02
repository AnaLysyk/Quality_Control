"use client";

export function AuthSkeleton({ message }: { message?: string }) {
  return (
    <div className="p-4 space-y-3">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
      <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
      {message && <div className="text-xs text-gray-500">{message}</div>}
    </div>
  );
}
