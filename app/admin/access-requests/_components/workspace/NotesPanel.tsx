export function NotesPanel({
  value,
  locked,
  onChange,
  onSave,
}: {
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Observações internas</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Notas da análise</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Informação visível apenas para administradores/revisores.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">Interno</span>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onSave}
        placeholder={locked ? "Solicitação finalizada." : "Registre contexto, validação do gestor, motivo da decisão ou ressalvas internas..."}
        rows={3}
        disabled={locked}
        className="mt-4 w-full resize-none rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--tc-accent)] focus:ring-4 focus:ring-[rgba(239,0,1,0.10)] disabled:bg-slate-100 disabled:text-slate-600"
      />
    </section>
  );
}
