"use client";

import dynamic from "next/dynamic";

function LoadingSkeleton() {
  return (
    <div className="flex h-full w-full animate-pulse flex-col gap-4 p-6">
      <div className="h-10 w-64 rounded-2xl bg-white/70" />
      <div className="flex flex-1 gap-4">
        <div className="w-80 rounded-2xl bg-white/70" />
        <div className="flex-1 rounded-2xl bg-white/70" />
      </div>
    </div>
  );
}

const Base64Studio = dynamic(() => import("./Base64Studio"), {
  ssr: false,
  loading: LoadingSkeleton,
});

export default function Base64Page() {
  return <Base64Studio />;
}
