"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ManualReleaseActionsProps = {
  slug: string;
  editable: boolean;
};

export default function ManualReleaseActions({ slug, editable }: ManualReleaseActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!editable) return null;

  const finalize = async () => {
    setLoading(true);
    try {
      await fetch(`/api/releases-manual/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FINALIZADA" }),
      });
      router.refresh();
    } catch (e) {
      console.error("Erro ao finalizar release manual", e);
    } finally {
      setLoading(false);
    }
  };

  const editTitle = async () => {
    const next = prompt("Novo título da release:");
    if (!next) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/releases-manual/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next, name: next }),
      });
      if (res.ok) router.refresh();
    } catch (e) {
      console.error("Erro ao editar release manual", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={editTitle}
        disabled={loading}
        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
      >
        {loading ? "Salvando..." : "Editar título"}
      </button>
      <button
        type="button"
        onClick={finalize}
        disabled={loading}
        className="rounded-xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "..." : "Finalizar release"}
      </button>
    </div>
  );
}
