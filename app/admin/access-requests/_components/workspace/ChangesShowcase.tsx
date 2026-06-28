import type { AccessRequestComparisonRow } from "../../_types/accessRequests.types";

function ChangeBadge({ changed }: { changed: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
        changed
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {changed ? "Alterado" : "Igual"}
    </span>
  );
}

function CellText({ value, strong = false }: { value: string; strong?: boolean }) {
  return (
    <p className={`whitespace-pre-wrap break-words text-sm leading-6 ${strong ? "font-bold text-slate-950" : "font-medium text-slate-600"}`}>
      {value || "Não informado"}
    </p>
  );
}

export function ChangesShowcase({ rows }: { rows: AccessRequestComparisonRow[] }) {
  const changed = rows.filter((row) => row.changed);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Revisão dos dados</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Origem recebida → como vai ficar</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Compare campo a campo antes de decidir. Alterações ficam destacadas.
          </p>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
          {changed.length} alteração(ões)
        </span>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <th className="w-[18%] px-5 py-3">Campo</th>
              <th className="w-[34%] px-5 py-3">Origem recebida</th>
              <th className="w-[34%] px-5 py-3">Como vai ficar</th>
              <th className="w-[14%] px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`change-row-${row.label}`} className="border-t border-slate-100">
                <td className="border-t border-slate-100 px-5 py-4 align-top text-sm font-black text-slate-800">
                  {row.label}
                </td>
                <td className="border-t border-slate-100 px-5 py-4 align-top">
                  <CellText value={row.originalText} />
                </td>
                <td className={`border-t border-slate-100 px-5 py-4 align-top ${row.changed ? "bg-amber-50/45" : ""}`}>
                  <CellText value={row.currentText} strong={row.changed} />
                </td>
                <td className="border-t border-slate-100 px-5 py-4 align-top">
                  <ChangeBadge changed={row.changed} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {rows.map((row) => (
          <article key={`change-card-${row.label}`} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-black text-slate-900">{row.label}</h4>
              <ChangeBadge changed={row.changed} />
            </div>
            <div className="mt-3 grid gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Origem recebida</p>
                <CellText value={row.originalText} />
              </div>
              <div className={row.changed ? "rounded-xl bg-amber-50 p-3" : ""}>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Como vai ficar</p>
                <CellText value={row.currentText} strong={row.changed} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
