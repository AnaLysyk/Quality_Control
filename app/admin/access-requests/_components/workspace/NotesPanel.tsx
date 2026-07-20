const INTERNAL_NOTES_LIMIT = 1200;

type NotesPanelProps = Readonly<{
  value: string;
  locked: boolean;
  saving?: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}>;

export function NotesPanel({
  value,
  locked,
  saving,
  onChange,
  onSave,
}: NotesPanelProps) {
  const limitedValue = value.slice(0, INTERNAL_NOTES_LIMIT);
  const remaining = INTERNAL_NOTES_LIMIT - limitedValue.length;

  return (
    <section className="rounded-[1.65rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Interno</p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Notas internas da análise</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Registro privado do revisor. Não aparece para o solicitante e deve acompanhar o cadastro quando o usuário for criado.
        </p>
      </div>

      <div className="p-5">
        <textarea
          value={limitedValue}
          maxLength={INTERNAL_NOTES_LIMIT}
          onChange={(event) => onChange(event.target.value.slice(0, INTERNAL_NOTES_LIMIT))}
          placeholder={locked ? "Solicitação finalizada." : "Ex.: validar empresa antes da aprovação; e-mail confirmado por contato interno; manter observação no cadastro do usuário..."}
          rows={9}
          disabled={locked}
          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-600"
          data-testid="access-request-internal-notes"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={`text-xs font-bold ${remaining <= 100 ? "text-amber-700" : "text-slate-400"}`}>
              {limitedValue.length}/{INTERNAL_NOTES_LIMIT}
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Visível somente para revisores/admins.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSave(limitedValue)}
            disabled={locked || saving}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar nota interna"}
          </button>
        </div>
      </div>
    </section>
  );
}
