const INTERNAL_NOTES_LIMIT = 200;

export function NotesPanel({
  value,
  locked,
  saving,
  onChange,
  onSave,
}: {
  value: string;
  locked: boolean;
  saving?: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}) {
  const limitedValue = value.slice(0, INTERNAL_NOTES_LIMIT);
  const remaining = INTERNAL_NOTES_LIMIT - limitedValue.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Interno</p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Notas da análise</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Texto salvo apenas para revisores. Máximo de 200 caracteres.
        </p>
      </div>

      <textarea
        value={limitedValue}
        maxLength={INTERNAL_NOTES_LIMIT}
        onChange={(event) => onChange(event.target.value.slice(0, INTERNAL_NOTES_LIMIT))}
        placeholder={locked ? "Solicitação finalizada." : "Resumo interno da análise..."}
        rows={7}
        disabled={locked}
        className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-600"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={`text-xs font-bold ${remaining <= 20 ? "text-amber-700" : "text-slate-400"}`}>
          {limitedValue.length}/{INTERNAL_NOTES_LIMIT}
        </span>
        <button
          type="button"
          onClick={() => onSave(limitedValue)}
          disabled={locked || saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar nota"}
        </button>
      </div>
    </section>
  );
}
