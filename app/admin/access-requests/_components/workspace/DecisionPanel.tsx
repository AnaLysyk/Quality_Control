import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FiAlertTriangle, FiCheckCircle, FiEdit3, FiSend, FiX, FiXCircle } from "react-icons/fi";

type RejectionReasonOption = {
  value: string;
  label: string;
};

type DecisionPanelProps = {
  status: string;
  passwordProvided: boolean;
  requiresCompany: boolean;
  hasCompany: boolean;
  accepting: boolean;
  requestingAdjustment: boolean;
  commentsLocked: boolean;
  acceptDisabled: boolean;
  selectedIsPasswordReset: boolean;
  adjustmentFieldCount: number;
  adjustmentReady: boolean;
  hasAdjustmentFieldsWithoutNotes: boolean;
  commentDraft: string;
  rejectionReasonDraft: string;
  rejectionReasons: readonly RejectionReasonOption[];
  onRejectionReasonChange: (value: string) => void;
  onRequestAdjustment: () => void;
  onReject: () => void | Promise<void>;
  onApprove: () => void | Promise<void>;
};

function finalTitle(status: string) {
  if (status === "closed") return "SolicitaÃ§Ã£o aprovada";
  if (status === "rejected") return "SolicitaÃ§Ã£o recusada";
  return "SolicitaÃ§Ã£o finalizada";
}

export function DecisionPanel({
  status,
  requiresCompany,
  hasCompany,
  accepting,
  requestingAdjustment,
  commentsLocked,
  acceptDisabled,
  selectedIsPasswordReset,
  adjustmentFieldCount,
  adjustmentReady,
  hasAdjustmentFieldsWithoutNotes,
  commentDraft,
  rejectionReasonDraft,
  rejectionReasons,
  onRejectionReasonChange,
  onRequestAdjustment,
  onReject,
  onApprove,
}: DecisionPanelProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);

  if (commentsLocked) {
    return (
      <div className="sticky bottom-0 z-30 rounded-2xl border border-slate-200 bg-white/98 px-4 py-3 shadow-[0_-10px_36px_rgba(15,23,42,0.10)] backdrop-blur dark:border-slate-700/60 dark:bg-[#0d1b2f]/95">
        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{finalTitle(status)}</p>
      </div>
    );
  }

  const companyPending = requiresCompany && !hasCompany;
  const canRequestAdjustment =
    !requestingAdjustment &&
    !selectedIsPasswordReset &&
    adjustmentFieldCount > 0 &&
    adjustmentReady;
  const canReject = !accepting && (Boolean(rejectionReasonDraft) || commentDraft.trim().length > 0);
  const approvalBlocked = acceptDisabled || companyPending || hasAdjustmentFieldsWithoutNotes;
  const selectedRejectionReason =
    rejectionReasons.find((reason) => reason.value === rejectionReasonDraft)?.label ?? "";
  const rejectionSummary = selectedRejectionReason || commentDraft.trim();
  const isRejecting = pendingDecision === "reject";
  const isApproving = pendingDecision === "approve" || (accepting && pendingDecision !== "reject");

  async function confirmReject() {
    if (!canReject || isRejecting) return;
    setPendingDecision("reject");
    try {
      await onReject();
      setRejectOpen(false);
    } finally {
      setPendingDecision(null);
    }
  }

  async function confirmApprove() {
    if (approvalBlocked || isApproving) return;
    setPendingDecision("approve");
    try {
      await onApprove();
    } finally {
      setPendingDecision(null);
    }
  }

  return (
    <section className="sticky bottom-0 z-30 rounded-xl border border-slate-200 bg-white/98 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/60 dark:bg-[#0d1b2f]/95">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">AÃ§Ãµes da solicitaÃ§Ã£o</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-600">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Ações da solicitação</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {adjustmentFieldCount > 0
              ? `${adjustmentFieldCount} campo(s) marcados para ajuste`
              : "Nenhum ajuste marcado"}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onRequestAdjustment}
            disabled={!canRequestAdjustment}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/45"
          >
            <FiEdit3 />
            {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
          </button>

          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            aria-label="Recusar solicitaÃ§Ã£o"
            disabled={accepting || isRejecting}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/45"
          >
            <FiXCircle />
            {isRejecting ? "Recusando..." : "Recusar"}
          </button>

          <button
            type="button"
            onClick={() => void confirmApprove()}
            aria-label="Aprovar solicitaÃ§Ã£o"
            disabled={approvalBlocked || isRejecting}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-700 dark:hover:bg-sky-600"
          >
            <FiCheckCircle />
            {isApproving ? "Aprovando..." : selectedIsPasswordReset ? "Aprovar reset" : "Aprovar"}
          </button>
        </div>
      </div>

      <Dialog.Root open={rejectOpen} onOpenChange={(open) => !isRejecting && setRejectOpen(open)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[220] bg-slate-950/55 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[221] w-[min(560px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-rose-100 bg-white shadow-[0_34px_100px_rgba(15,23,42,0.35)] dark:border-rose-400/30 dark:bg-[#0d1b2f]">
            <div className="bg-[linear-gradient(135deg,#7f1d1d_0%,#be123c_60%,#ef4444_130%)] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15">
                    <FiAlertTriangle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <Dialog.Title className="text-xl font-black tracking-tight text-white">
                      VocÃª tem certeza?
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm font-semibold leading-6 text-white/82">
                      A solicitaÃ§Ã£o serÃ¡ marcada como recusada e o motivo ficarÃ¡ registrado no histÃ³rico.
                    </Dialog.Description>
                  </div>
                </div>

                <Dialog.Close
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Fechar confirmaÃ§Ã£o de recusa"
                >
                  <FiX className="h-4 w-4" />
                </Dialog.Close>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Motivo da recusa
                </span>
                <select
                  value={rejectionReasonDraft}
                  onChange={(event) => onRejectionReasonChange(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 dark:border-slate-700/60 dark:bg-[#071426] dark:text-slate-100 dark:focus:ring-rose-950/40"
                  data-testid="access-request-rejection-reason"
                  aria-label="Motivo da rejeiÃ§Ã£o"
                >
                  <option value="">Selecionar motivo</option>
                  {rejectionReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">
                  O que serÃ¡ enviado
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 dark:border-rose-400/40 dark:bg-rose-950/30">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">
                  O que será enviado
                </p>
                <p className="mt-1 text-sm font-bold leading-6 text-rose-950 dark:text-rose-50">
                  {rejectionSummary || "Selecione um motivo ou escreva uma justificativa na conversa antes de confirmar."}
                </p>
              </div>

              <p className="text-sm font-semibold leading-6 text-slate-600">
                Para justificar por mensagem, escreva no chat da solicitaÃ§Ã£o antes de confirmar a recusa.
              <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                Para justificar por mensagem, escreva no chat da solicitação antes de confirmar a recusa.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-700/60 dark:bg-[#071426]">
              <Dialog.Close className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:bg-[#0d1b2f] dark:text-slate-200 dark:hover:bg-[#13243b]">
                Cancelar
              </Dialog.Close>

              <button
                type="button"
                onClick={() => void confirmReject()}
                disabled={!canReject || isRejecting}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_14px_30px_rgba(225,29,72,0.24)] transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <FiSend className="h-4 w-4" />
                {isRejecting ? "Recusando..." : "Sim, recusar solicitaÃ§Ã£o"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

