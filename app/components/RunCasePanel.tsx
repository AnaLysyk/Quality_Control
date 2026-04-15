"use client";

import { createPortal } from "react-dom";
import { FiExternalLink, FiX } from "react-icons/fi";
import type { KanbanData, KanbanItem } from "@/types/kanban";

const STATUS_CONFIG: Record<keyof KanbanData, { label: string; cls: string }> = {
  pass: { label: "Pass", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  fail: { label: "Fail", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  blocked: { label: "Blocked", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  notRun: { label: "Not Run", cls: "border-slate-200 bg-slate-50 text-slate-600" },
};

function buildQaseCaseLink(caseId: number | string, project: string): string | null {
  if (!caseId || !project) return null;
  return `https://app.qase.io/case/${project.toUpperCase()}/${caseId}`;
}

type RunCasePanelProps = {
  item: KanbanItem | null;
  columnKey: keyof KanbanData | null;
  projectCode: string;
  onClose: () => void;
};

export function RunCasePanel({ item, columnKey, projectCode, onClose }: RunCasePanelProps) {
  if (!item || !columnKey) return null;

  const qaseLink = item.fromApi ? buildQaseCaseLink(item.id, projectCode) : null;
  const evidenceLink = (item.link ?? "").trim() || null;
  const bugLink = (item.bug ?? "").trim() || null;
  const bugIsUrl = bugLink ? /^https?:\/\//i.test(bugLink) : false;
  const statusInfo = STATUS_CONFIG[columnKey];

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do caso de teste"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Caso de teste</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900 leading-snug wrap-break-word">
              {item.title || "Sem título"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 mt-0.5 text-slate-400 hover:text-slate-700 transition"
            aria-label="Fechar painel de detalhes"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            ID: {item.id}
          </span>
          {statusInfo && (
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          )}
          {item.fromApi && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Qase API
            </span>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          {qaseLink ? (
            <a
              href={qaseLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-(--tc-accent,#ef0001) transition"
            >
              <FiExternalLink size={14} className="shrink-0" />
              Abrir no Qase
            </a>
          ) : null}

          {evidenceLink ? (
            <a
              href={evidenceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-(--tc-accent,#ef0001) transition"
            >
              <FiExternalLink size={14} className="shrink-0" />
              Evidência
            </a>
          ) : (
            <p className="text-sm text-slate-400 italic">Sem evidência vinculada</p>
          )}

          {bugLink ? (
            bugIsUrl ? (
              <a
                href={bugLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-800 transition"
              >
                <FiExternalLink size={14} className="shrink-0" />
                Bug
              </a>
            ) : (
              <p className="text-sm text-slate-700">
                Bug: <span className="font-semibold">{bugLink}</span>
              </p>
            )
          ) : (
            <p className="text-sm text-slate-400 italic">Sem bug vinculado</p>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
