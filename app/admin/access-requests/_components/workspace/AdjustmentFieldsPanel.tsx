import type { AdjustmentFieldOptionView } from "../../_types/accessRequests.types";

export function AdjustmentFieldsPanel({
  options,
  selectedFields,
  comments,
  onToggle,
  onCommentChange,
}: {
  options: AdjustmentFieldOptionView[];
  selectedFields: string[];
  comments: Record<string, string>;
  onToggle: (field: string) => void;
  onCommentChange: (field: string, value: string) => void;
}) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Campos para correção</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">O que o solicitante pode alterar</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Marque os campos liberados. O botão Solicitar ajuste usa esta seleção e a mensagem ao lado.</p>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
          {selectedFields.length} campo(s)
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = selectedFields.includes(option.field);
          return (
            <button
              key={`adjustment-field-${option.field}`}
              type="button"
              onClick={() => onToggle(option.field)}
              className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-black transition ${
                selected
                  ? "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_8px_18px_rgba(225,29,72,0.1)]"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[rgba(239,0,1,0.28)] hover:text-slate-950"
              }`}
              title={option.hint}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {selectedFields.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {selectedFields.map((field) => {
            const option = options.find((item) => item.field === field);
            return (
              <label key={`adjustment-comment-${field}`} className="text-xs font-black text-slate-600">
                Observação para {option?.label ?? field}
                <input
                  type="text"
                  value={comments[field] ?? ""}
                  onChange={(event) => onCommentChange(field, event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                  data-testid={`access-request-adjustment-comment-${field}`}
                />
              </label>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
