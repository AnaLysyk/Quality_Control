"use client";

import { useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";

type EditReleaseButtonProps = {
  slug: string;
  currentTitle?: string;
  currentRunId?: number;
};

export function EditReleaseButton({ slug, currentTitle, currentRunId }: EditReleaseButtonProps) {
  const { user, loading: authLoading } = useAuthUser();
  const [loading, setLoading] = useState(false);

  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const canEdit = Boolean(user?.isGlobalAdmin || role === "admin" || role === "company");

  if (authLoading || !canEdit) return null;

  const handleEdit = async () => {
    const nextTitle = prompt("Novo titulo da run:", currentTitle ?? "");
    const nextRun = prompt("Novo runId (Qase):", currentRunId ? String(currentRunId) : "");
    if (!nextTitle && !nextRun) return;
    setLoading(true);
    try {
      await fetch(`/api/releases/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nextTitle || undefined,
          runId: nextRun ? Number(nextRun) : undefined,
        }),
      });
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      data-testid="run-edit"
      type="button"
      onClick={handleEdit}
      disabled={loading}
      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15 disabled:opacity-60"
    >
      {loading ? "Salvando..." : "Editar run"}
    </button>
  );
}
