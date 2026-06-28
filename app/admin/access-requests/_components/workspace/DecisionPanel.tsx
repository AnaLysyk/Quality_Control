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
  onReject: () => void;
  onApprove: () => void;
};

function finalTitle(status: string) {
  if (status === "closed") return "Solicitacao aprovada";
  if (status === "rejected") return "Solicitacao recusada";
  return "Solicitacao finalizada";
}

function finalDescription(status: string) {
  if (status === "closed") return "Acesso liberado. As acoes ficam bloqueadas para preservar o historico.";
  if (status === "rejected") return "Solicitacao encerrada sem liberacao de acesso. As acoes ficam bloqueadas para preservar o historico.";
  return "Fluxo encerrado. As acoes ficam bloqueadas.";
}

function StatusPill({ children, tone }: { children: string; tone: "ok" | "warn" | "neutral" | "danger" }) {
  const className =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-red-800"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${className}`}>{children}</span>;
}

export function DecisionPanel({
  status,
  passwordProvided,
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
  if (commentsLocked) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Decisao</p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{finalTitle(status)}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{finalDescription(status)}</p>
      </section>
    );
  }

  const companyPending = requiresCompany && !hasCompany;
  const canRequestAdjustment =
    !requestingAdjustment &&
    !selectedIsPasswordReset &&
    adjustmentFieldCount > 0 &&
    adjustmentReady;
  const canReject = !accepting && (Boolean(rejectionReasonDraft) || commentDraft.trim().length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Decisao</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Concluir analise</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Use os campos marcados para devolver ajustes ou aprove quando nao houver pendencia no cadastro.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill tone={passwordProvided ? "ok" : "warn"}>{passwordProvided ? "Senha OK" : "Senha pendente"}</StatusPill>
          {companyPending ? <StatusPill tone="warn">Empresa obrigatoria</StatusPill> : <StatusPill tone="ok">Empresa OK</StatusPill>}
          {adjustmentFieldCount > 0 ? <StatusPill tone="danger">{`${adjustmentFieldCount} campo(s) para ajuste`}</StatusPill> : null}
          {hasAdjustmentFieldsWithoutNotes ? <StatusPill tone="warn">Observacao pendente</StatusPill> : null}
          {acceptDisabled ? <StatusPill tone="warn">Aprovacao bloqueada</StatusPill> : <StatusPill tone="ok">Pronto para aprovar</StatusPill>}
        </div>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[minmax(220px,0.8fr)_auto_auto_auto] xl:items-end">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Motivo da recusa</span>
          <select
            value={rejectionReasonDraft}
            onChange={(event) => onRejectionReasonChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400"
            data-testid="access-request-rejection-reason"
            aria-label="Motivo da rejeicao"
          >
            <option value="">Selecionar se for recusar</option>
            {rejectionReasons.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onRequestAdjustment}
          disabled={!canRequestAdjustment}
          className="h-11 rounded-xl border border-amber-300 bg-amber-50 px-5 text-xs font-black uppercase tracking-[0.14em] text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
        </button>

        <button
          type="button"
          onClick={onReject}
          aria-label="Recusar solicitacao"
          disabled={!canReject}
          className="h-11 rounded-xl border border-rose-300 bg-rose-50 px-5 text-xs font-black uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {accepting ? "Processando..." : "Recusar"}
        </button>

        <button
          type="button"
          onClick={onApprove}
          aria-label="Aprovar solicitacao"
          disabled={acceptDisabled}
          className="h-11 rounded-xl bg-slate-950 px-6 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {accepting ? "Aprovando..." : selectedIsPasswordReset ? "Aprovar reset" : "Aprovar acesso"}
        </button>
      </div>

      <div className="border-t border-slate-100 px-5 py-3 text-xs font-semibold text-slate-500">
        Solicitar ajuste envia os campos marcados e suas observacoes. O chat pode ser usado separadamente e nao e obrigatorio para ajuste.
      </div>
    </section>
  );
}
