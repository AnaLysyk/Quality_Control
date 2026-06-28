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
  commentDraft: string;
  rejectionReasonDraft: string;
  rejectionReasons: readonly RejectionReasonOption[];
  onRejectionReasonChange: (value: string) => void;
  onRequestAdjustment: () => void;
  onReject: () => void;
  onApprove: () => void;
};

function finalTitle(status: string) {
  if (status === "closed") return "Solicitação aprovada";
  if (status === "rejected") return "Solicitação recusada";
  return "Solicitação finalizada";
}

function finalDescription(status: string) {
  if (status === "closed") return "Acesso liberado. As ações ficam bloqueadas para preservar o histórico.";
  if (status === "rejected") return "Solicitação encerrada sem liberação de acesso. As ações ficam bloqueadas para preservar o histórico.";
  return "Fluxo encerrado. As ações ficam bloqueadas.";
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
      <section className={`rounded-[26px] border p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] ${
        status === "closed"
          ? "border-emerald-200 bg-emerald-50"
          : status === "rejected"
            ? "border-rose-200 bg-rose-50"
            : "border-slate-200 bg-white"
      }`}>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Decisão da solicitação</p>
        <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{finalTitle(status)}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{finalDescription(status)}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-black text-slate-700">Botões bloqueados</span>
          <span className="rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
            {passwordProvided ? "Senha informada" : "Senha pendente"}
          </span>
        </div>
      </section>
    );
  }

  const companyPending = requiresCompany && !hasCompany;

  return (
    <section className="rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_46px_rgba(15,23,42,0.10)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Decisão da solicitação</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Concluir ou devolver</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Depois de revisar alterações, mensagem e campos, escolha a ação final.</p>
        </div>

        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${acceptDisabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {acceptDisabled ? "Com pendências" : "Pronto para aprovar"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${passwordProvided ? "border border-emerald-300 bg-emerald-100 text-emerald-800" : "border border-rose-300 bg-rose-100 text-rose-800"}`}>
          {passwordProvided ? "Senha válida" : "Senha ausente"}
        </span>

        {companyPending ? (
          <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
            Empresa obrigatória
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
        Para solicitar ajuste, selecione ao menos um campo para correção e escreva a mensagem ao solicitante. Para recusar, escolha um motivo ou escreva uma mensagem.
      </div>

      <div className="mt-5 grid w-full gap-3 lg:grid-cols-[minmax(220px,0.7fr)_auto_auto_auto] lg:items-center">
        <select
          value={rejectionReasonDraft}
          onChange={(event) => onRejectionReasonChange(event.target.value)}
          className="min-h-12 rounded-[18px] border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
          data-testid="access-request-rejection-reason"
          aria-label="Motivo da rejeição"
        >
          <option value="">Motivo da rejeição</option>
          {rejectionReasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRequestAdjustment}
          disabled={requestingAdjustment || selectedIsPasswordReset || !commentDraft.trim() || adjustmentFieldCount === 0}
          className="rounded-[18px] border border-amber-300 bg-amber-50 px-5 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
        </button>

        <button
          type="button"
          onClick={onReject}
          aria-label="Recusar solicitação"
          disabled={accepting || (!rejectionReasonDraft && !commentDraft.trim())}
          className="rounded-[18px] border border-rose-300 bg-rose-50 px-5 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accepting ? "Processando..." : "Recusar"}
        </button>

        <button
          type="button"
          onClick={onApprove}
          aria-label="Aprovar solicitação"
          disabled={acceptDisabled}
          className="rounded-[18px] bg-[var(--tc-primary)] px-7 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_38px_rgba(1,24,72,0.26)] transition hover:-translate-y-0.5 hover:bg-[rgba(1,24,72,0.88)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accepting ? "Aprovando..." : selectedIsPasswordReset ? "Aprovar reset" : "Aprovar acesso"}
        </button>
      </div>
    </section>
  );
}
