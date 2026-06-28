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
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Interno</p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Notas da análise</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Anotações para revisores. Não são enviadas ao solicitante.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={locked ? "Solicitação finalizada." : "Registre contexto, validação ou ressalvas internas..."}
        rows={7}
        disabled={locked}
        className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-600"
      />

      <button
        type="button"
        onClick={onSave}
        disabled={locked || saving}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar nota"}
      </button>
    </section>
  );
}
