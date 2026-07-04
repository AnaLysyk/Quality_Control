"use client";

import UserAvatar from "@/components/UserAvatar";

export function VisaoGeralAvatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-1">
      <UserAvatar src={src} name={name} size="sm" frameClassName="shadow-none border-white/70" fallbackClassName="text-[0.7rem] tracking-[0.12em]" />
    </div>
  );
}
