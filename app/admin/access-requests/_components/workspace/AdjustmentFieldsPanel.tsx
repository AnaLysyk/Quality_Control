import type { AdjustmentFieldOptionView } from "../../_types/accessRequests.types";

type AdjustmentFieldsPanelProps = Readonly<{
  options: AdjustmentFieldOptionView[];
  selectedFields: string[];
  comments: Record<string, string>;
  onToggle: (field: string) => void;
  onCommentChange: (field: string, value: string) => void;
}>;

export function AdjustmentFieldsPanel({
  options,
  selectedFields,
  comments,
  onToggle,
  onCommentChange,
}: AdjustmentFieldsPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Campos liberados</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">O que pode ser corrigido</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Necessário para Solicitar ajuste.
          </p>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
          {selectedFields.length} selecionado(s)
        </span>
      </div>

      <div className="grid gap-2 p-5">
        {options.map((option) => {
          const selected = selectedFields.includes(option.field);
          return (
            <button
              key={`adjustment-field-${option.field}`}
              type="button"
              onClick={() => onToggle(option.field)}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                selected
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
              title={option.hint}
              aria-pressed={selected}
            >
              <span className="text-sm font-bold">{option.label}</span>
              <span className={`h-4 w-4 rounded-full border ${selected ? "border-white bg-white" : "border-slate-300"}`} />
            </button>
          );
        })}
      </div>

      {selectedFields.length > 0 ? (
        <div className="border-t border-slate-100 p-5 pt-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Observações por campo</p>
          <div className="mt-3 grid gap-3">
            {selectedFields.map((field) => {
              const option = options.find((item) => item.field === field);
              return (
                <label key={`adjustment-comment-${field}`} className="block">
                  <span className="text-xs font-bold text-slate-500">{option?.label ?? field}</span>
                  <input
                    type="text"
                    value={comments[field] ?? ""}
                    onChange={(event) => onCommentChange(field, event.target.value)}
                    placeholder="Instrução específica para este campo"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-400"
                    data-testid={`access-request-adjustment-comment-${field}`}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
