"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthUser } from "@/hooks/useAuthUser";

type ManualReleaseActionsProps = {
  slug: string;
  status?: string;
  gateStatus?: "approved" | "warning" | "failed" | "no_data";
};

type ResponsibleOption = {
  userId: string;
  label: string;
  name: string;
  email?: string | null;
};

type ManualReleaseDetailsResponse = {
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  availableResponsibles?: ResponsibleOption[];
  message?: string;
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
  const [responsibleOpen, setResponsibleOpen] = useState(false);
  const [responsibleLoading, setResponsibleLoading] = useState(false);
  const [responsibleSaving, setResponsibleSaving] = useState(false);
  const [responsibleError, setResponsibleError] = useState<string | null>(null);
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([]);
  const [responsibleDraft, setResponsibleDraft] = useState("");
  const [responsibleSaved, setResponsibleSaved] = useState("");
  const [responsibleLabel, setResponsibleLabel] = useState<string | null>(null);

  if (authLoading || !canEdit) return null;

  const finalized = isFinalStatus(status);
  const gateBlocked = gateStatus === "failed";
  const responsibleChanged = responsibleDraft !== responsibleSaved;

  const openResponsibleEditor = async () => {
    setResponsibleOpen(true);
    setResponsibleLoading(true);
    setResponsibleError(null);
    try {
      const res = await fetch(`/api/releases-manual/${slug}`, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as ManualReleaseDetailsResponse | null;
      if (!res.ok || !payload) {
        throw new Error("Nao foi possivel carregar os responsaveis.");
      }
      const options = Array.isArray(payload.availableResponsibles) ? payload.availableResponsibles : [];
      const currentId =
        (typeof payload.assignedToUserId === "string" && payload.assignedToUserId.trim()) ||
        (typeof payload.createdByUserId === "string" && payload.createdByUserId.trim()) ||
        options[0]?.userId ||
        "";
      setResponsibleOptions(options);
      setResponsibleDraft(currentId);
      setResponsibleSaved(currentId);
      setResponsibleLabel(
        typeof payload.assignedToName === "string" && payload.assignedToName.trim()
          ? payload.assignedToName.trim()
          : typeof payload.createdByName === "string" && payload.createdByName.trim()
            ? payload.createdByName.trim()
            : null,
      );
    } catch (error) {
      console.error("Erro ao carregar responsavel da run manual", error);
      setResponsibleOptions([]);
      setResponsibleDraft("");
      setResponsibleSaved("");
      setResponsibleError("Nao foi possivel carregar os usuarios vinculados.");
    } finally {
      setResponsibleLoading(false);
    }
  };

  const saveResponsible = async () => {
    setResponsibleSaving(true);
    setResponsibleError(null);
    try {
      const res = await fetch(`/api/releases-manual/${slug}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserId: responsibleDraft || null }),
      });
      const payload = (await res.json().catch(() => null)) as ManualReleaseDetailsResponse | null;
      if (!res.ok || !payload) {
        const message = payload?.message || "Nao foi possivel atualizar o responsavel.";
        throw new Error(message);
      }
      const options = Array.isArray(payload.availableResponsibles) ? payload.availableResponsibles : responsibleOptions;
      const currentId =
        (typeof payload.assignedToUserId === "string" && payload.assignedToUserId.trim()) ||
        (typeof payload.createdByUserId === "string" && payload.createdByUserId.trim()) ||
        options[0]?.userId ||
        "";
      setResponsibleOptions(options);
      setResponsibleDraft(currentId);
      setResponsibleSaved(currentId);
      setResponsibleLabel(
        typeof payload.assignedToName === "string" && payload.assignedToName.trim()
          ? payload.assignedToName.trim()
          : typeof payload.createdByName === "string" && payload.createdByName.trim()
            ? payload.createdByName.trim()
            : null,
      );
      setResponsibleOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Erro ao salvar responsavel da run manual", error);
      setResponsibleError(error instanceof Error ? error.message : "Nao foi possivel atualizar o responsavel.");
    } finally {
      setResponsibleSaving(false);
    }
  };

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
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={editTitle}
          disabled={loading}
          className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Editar titulo"}
        </button>
        <button
          type="button"
          onClick={() => void openResponsibleEditor()}
          disabled={loading || responsibleLoading}
          className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          {responsibleLoading ? "Carregando..." : "Editar responsavel"}
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
            disabled={loading || gateBlocked}
            aria-disabled={gateBlocked}
            data-testid="release-approve"
            className="rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "..." : "Finalizar run"}
          </button>
        )}
      </div>

      {(gateBlocked && !finalized) || responsibleLabel || responsibleOpen ? (
        <div className="flex w-full max-w-[360px] flex-col gap-2">
          {gateBlocked && !finalized ? (
            <p className="text-xs text-rose-200" data-testid="quality-gate-blocked-message">
              Qualidade insuficiente para aprovacao
            </p>
          ) : null}
          {responsibleLabel && !responsibleOpen ? (
            <p className="text-xs text-white/75">Responsavel atual: {responsibleLabel}</p>
          ) : null}
          {responsibleOpen ? (
            <div className="w-full rounded-2xl border border-white/15 bg-[#081733]/90 p-4 shadow-[0_18px_45px_rgba(2,6,23,0.3)] backdrop-blur-sm">
              <div className="mb-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">Responsavel</p>
                <p className="text-sm font-semibold text-white">
                  {responsibleLabel ? `Atual: ${responsibleLabel}` : "Defina quem responde por esta run."}
                </p>
                <p className="text-xs text-white/65">
                  Podem ser escolhidos usuarios da empresa ou usuarios da Testing Company vinculados a ela.
                </p>
              </div>

              {responsibleLoading ? (
                <p className="text-xs text-white/70">Carregando usuarios vinculados...</p>
              ) : responsibleOptions.length > 0 ? (
                <div className="space-y-3">
                  <Select value={responsibleDraft || undefined} onValueChange={setResponsibleDraft}>
                    <SelectTrigger className="h-11 rounded-2xl border-white/15 bg-white/95 text-[#0b1a3c]">
                      <SelectValue placeholder="Selecione o responsavel" />
                    </SelectTrigger>
                    <SelectContent>
                      {responsibleOptions.map((option) => (
                        <SelectItem key={option.userId} value={option.userId}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResponsibleOpen(false);
                        setResponsibleError(null);
                        setResponsibleDraft(responsibleSaved);
                      }}
                      className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveResponsible()}
                      disabled={responsibleSaving || !responsibleDraft || !responsibleChanged}
                      className="rounded-xl bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                    >
                      {responsibleSaving ? "Salvando..." : "Salvar responsavel"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/70">Nenhum usuario vinculado foi encontrado para esta empresa.</p>
              )}

              {responsibleError ? <p className="mt-3 text-xs text-rose-200">{responsibleError}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
