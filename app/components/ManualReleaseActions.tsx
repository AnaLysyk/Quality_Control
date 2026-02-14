"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";

type ManualReleaseActionsProps = {
  slug: string;
  status?: string;
  gateStatus?: "approved" | "warning" | "failed" | "no_data";
};

function isFinalStatus(status?: string) {
  const s = (status ?? "").trim().toUpperCase();
  return s === "FINALIZADA" || s === "FINALIZED" || s === "FINALIZADO";
}

export default function ManualReleaseActions({ slug, status, gateStatus }: ManualReleaseActionsProps) {
  const { user, loading: authLoading } = useAuthUser();
  const router = useRouter();
  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const canEdit = Boolean(user?.isGlobalAdmin || role === "admin" || role === "company");
  const [loading, setLoading] = useState(false);

  if (authLoading || !canEdit) return null;

  const finalized = isFinalStatus(status);
  const gateBlocked = gateStatus === "failed";

  const finalize = async () => {
    if (gateBlocked) return;
    setLoading(true);
    try {
      await fetch(`/api/releases-manual/${slug}`, {
        method: "PATCH",
        credentials: "include",
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
        credentials: "include",
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
        credentials: "include",
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
        className="rounded-xl border border-[--tc-border]/20 bg-[--tc-surface]/10 px-3 py-2 text-xs font-semibold text-[--tc-text] hover:bg-[--tc-surface]/15 disabled:opacity-60"
      >
        {loading ? "Salvando..." : "Editar título"}
      </button>
      {finalized ? (
        <button
          type="button"
          onClick={reopen}
          disabled={loading}
          className="rounded-xl border border-[--tc-border]/20 bg-[--tc-surface]/10 px-4 py-2 text-sm font-semibold text-[--tc-text] hover:bg-[--tc-surface]/15 disabled:opacity-60"
        >
          {loading ? "..." : "Reabrir"}
        </button>
      ) : (
        <button
          type="button"
          onClick={finalize}
          disabled={loading || gateBlocked}
          aria-disabled={gateBlocked}
          data-testid="release-approve"
          className="rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "..." : "Finalizar run"}
        </button>
      )}
      {gateBlocked && !finalized && (
        <p className="text-xs text-[--tc-accent-soft]" data-testid="quality-gate-blocked-message">
          Qualidade insuficiente para aprovação
        </p>
      )}
    </div>
  );
}
