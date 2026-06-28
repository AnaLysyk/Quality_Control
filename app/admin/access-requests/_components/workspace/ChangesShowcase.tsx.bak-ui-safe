import type { AccessRequestComparisonRow } from "../../_types/accessRequests.types";

export function ChangesShowcase({ rows }: { rows: AccessRequestComparisonRow[] }) {
  const changed = rows.filter((row) => row.changed);

  return (
    <section className="self-start rounded-[26px] border border-amber-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#eff6ff_100%)] p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Alterações do solicitante</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">O que mudou antes de virar perfil</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Comparativo entre envio original e dados atuais.</p>
        </div>

        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
          {changed.length} alteração(ões)
        </span>
      </div>

      <div className="mt-5 grid max-h-[360px] gap-3 overflow-y-auto pr-1">
        {changed.length > 0 ? (
          changed.map((row) => (
            <article key={`visual-change-${row.label}`} className="overflow-hidden rounded-[22px] border border-amber-200 bg-white shadow-[0_14px_30px_rgba(217,119,6,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
                <h4 className="font-black text-slate-950">{row.label}</h4>
                <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                  Alterado
                </span>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-700">Antes</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-rose-900">{row.originalText}</p>
                </div>

                <div className="hidden items-center justify-center text-lg font-black text-slate-400 md:flex">→</div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 ring-2 ring-sky-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Agora / perfil</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-black leading-6 text-sky-950">{row.currentText}</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
            <p className="font-black">Nenhuma alteração identificada.</p>
            <p className="mt-1 text-sm leading-6">Os dados atuais estão iguais ao envio original.</p>
          </div>
        )}
      </div>
    </section>
  );
}
