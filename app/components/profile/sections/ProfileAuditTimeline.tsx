"use client";

/**
 * Profile Audit Timeline â€” HistÃ³rico de alteraÃ§Ãµes
 */

import { useProfileContext } from "@/lib/profile/useProfileContext";
import type { ProfileAuditEntry } from "@/lib/profile/types";

export type ProfileAuditTimelineProps = {
  entries: ProfileAuditEntry[];
  loading?: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  create: "CriaÃ§Ã£o",
  update_profile: "AtualizaÃ§Ã£o de perfil",
  update_permissions: "AlteraÃ§Ã£o de permissÃ£o",
  block: "Bloqueio",
  unblock: "Desbloqueio",
  deactivate: "DesativaÃ§Ã£o",
  archive: "Arquivamento",
};

export function ProfileAuditTimeline({
  entries,
  loading = false,
}: ProfileAuditTimelineProps) {
  const { visibleTabs } = useProfileContext();

  if (!visibleTabs.includes("audit")) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-tc-border p-6 bg-tc-surface">
        <h3 className="text-lg font-semibold text-tc-text-primary mb-6">
          HistÃ³rico de AlteraÃ§Ãµes
      <div className="rounded-lg border border-(--tc-border) bg-(--tc-surface) p-6">
        <h3 className="mb-6 text-lg font-semibold text-(--tc-text-primary)">
          Histórico de Alterações
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--tc-border) border-t-(--tc-accent)" />
        </div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="rounded-lg border border-tc-border p-6 bg-tc-surface">
        <h3 className="text-lg font-semibold text-tc-text-primary mb-6">
          HistÃ³rico de AlteraÃ§Ãµes
        </h3>
        <p className="text-sm text-tc-text-muted">Nenhuma alteraÃ§Ã£o registrada.</p>
      <div className="rounded-lg border border-(--tc-border) bg-(--tc-surface) p-6">
        <h3 className="mb-6 text-lg font-semibold text-(--tc-text-primary)">
          Histórico de Alterações
        </h3>
        <p className="text-sm text-(--tc-text-muted)">Nenhuma alteração registrada.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-tc-border p-6 bg-tc-surface">
      <h3 className="text-lg font-semibold text-tc-text-primary mb-6">
        HistÃ³rico de AlteraÃ§Ãµes
    <div className="rounded-lg border border-(--tc-border) bg-(--tc-surface) p-6">
      <h3 className="mb-6 text-lg font-semibold text-(--tc-text-primary)">
        Histórico de Alterações
      </h3>

      <div className="space-y-6">
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className={`flex gap-4 pb-6 ${idx < entries.length - 1 ? "border-b border-(--tc-border)" : ""}`}
          >
            {/* Timeline dot */}
            <div className="flex flex-col items-center gap-2">
              <div className="mt-1 h-3 w-3 rounded-full bg-(--tc-accent)" />
              {idx < entries.length - 1 && (
                <div className="h-12 w-0.5 bg-(--tc-border)" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-(--tc-text-primary)">
                    {ACTION_LABELS[entry.action] || entry.action}
                  </p>
                  <p className="text-xs text-(--tc-text-muted)">
                    {new Date(entry.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-(--tc-text-primary)">
                    {entry.actor.name}
                  </p>
                  <p className="text-xs uppercase text-(--tc-text-muted)">
                    {entry.actor.role}
                  </p>
                </div>
              </div>

              {entry.field && entry.before != null && entry.after != null ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-(--tc-text-muted)">
                    Campo: {entry.field}
                  </p>
                  <div className="flex gap-4 text-xs font-mono">
                    <div>
                      <span className="text-(--tc-text-muted)">De: </span>
                      <span className="text-red-600">
                        {JSON.stringify(entry.before)}
                      </span>
                    </div>
                    <div>
                      <span className="text-(--tc-text-muted)">Para: </span>
                      <span className="text-green-600">
                        {JSON.stringify(entry.after)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {entry.reason && (
                <p className="mt-2 text-xs italic text-(--tc-text-muted)">
                  Motivo: {entry.reason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

