import type { AccessRequestProfilePreview } from "../../_types/accessRequests.types";

type StatusBubblesProps = {
  profile: AccessRequestProfilePreview;
  missingRequiredFields: boolean;
  requiresCompany: boolean;
  changedCount: number;
  commentsLocked: boolean;
};

export function StatusBubbles({
  profile,
  missingRequiredFields,
  requiresCompany,
  changedCount,
  commentsLocked,
}: StatusBubblesProps) {
  const companyPending = requiresCompany && !profile.clientId;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={`rounded-[22px] border px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)] ${profile.passwordProvided ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${profile.passwordProvided ? "text-emerald-700" : "text-rose-700"}`}>Senha</p>
        <p className="mt-1 text-sm font-black text-slate-950">{profile.passwordProvided ? "Definida" : "Pendente"}</p>
      </div>

      <div className={`rounded-[22px] border px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)] ${missingRequiredFields ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${missingRequiredFields ? "text-amber-800" : "text-emerald-700"}`}>Obrigatórios</p>
        <p className="mt-1 text-sm font-black text-slate-950">{missingRequiredFields ? "Com pendências" : "OK"}</p>
      </div>

      <div className={`rounded-[22px] border px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)] ${companyPending ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${companyPending ? "text-amber-800" : "text-sky-700"}`}>Empresa</p>
        <p className="mt-1 text-sm font-black text-slate-950">{companyPending ? "Obrigatória" : "Validada"}</p>
      </div>

      <div className={`rounded-[22px] border px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)] ${commentsLocked ? "border-slate-200 bg-slate-50" : "border-violet-200 bg-violet-50"}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${commentsLocked ? "text-slate-600" : "text-violet-700"}`}>Alterações</p>
        <p className="mt-1 text-sm font-black text-slate-950">{changedCount} campo(s)</p>
      </div>
    </div>
  );
}
