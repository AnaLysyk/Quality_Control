"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ManualReleaseActionsProps = {
  slug: string;
  status?: string;
};

function isFinalStatus(status?: string) {
  const s = (status ?? "").trim().toUpperCase();
  return s === "FINALIZADA" || s === "FINALIZED" || s === "FINALIZADO";
}

export default function ManualReleaseActions({ slug, status }: ManualReleaseActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const finalized = isFinalStatus(status);

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
      console.error("Erro ao finalizar run manual", e);
    } finally {
      setLoading(false);
    }
  };

  const reopen = async () => {
    setLoading(true);
    try {
      await fetch(`/api/releases-manual/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      router.refresh();
    } catch (e) {
      console.error("Erro ao reabrir run manual", e);
    } finally {
      setLoading(false);
    }
  };

  const editTitle = async () => {
    const next = prompt("Novo titulo da run:");
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
      console.error("Erro ao editar run manual", e);
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
      {finalized ? (
        <button
          type="button"
          onClick={reopen}
          disabled={loading}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          {loading ? "..." : "Reabrir"}
        </button>
      ) : (
        <button
          type="button"
          onClick={finalize}
          disabled={loading}
          className="rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "..." : "Finalizar run"}
        </button>
      )}
    </div>
  );
}
