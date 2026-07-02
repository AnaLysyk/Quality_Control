const INTERNAL_NOTES_LIMIT = 1200;

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
    <section className="rounded-[1.65rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-[#0d1b2f]">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Interno</p>
<<<<<<< HEAD
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Notas internas da anÃ¡lise</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Registro privado do revisor. NÃ£o aparece para o solicitante e deve acompanhar o cadastro quando o usuÃ¡rio for criado.
=======
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Notas internas da análise</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Registro privado do revisor. Não aparece para o solicitante e deve acompanhar o cadastro quando o usuário for criado.
>>>>>>> fix/governanca-perfis-rotas
        </p>
      </div>

      <div className="p-5">
        <textarea
          value={limitedValue}
          maxLength={INTERNAL_NOTES_LIMIT}
          onChange={(event) => onChange(event.target.value.slice(0, INTERNAL_NOTES_LIMIT))}
          placeholder={locked ? "SolicitaÃ§Ã£o finalizada." : "Ex.: validar empresa antes da aprovaÃ§Ã£o; e-mail confirmado por contato interno; manter observaÃ§Ã£o no cadastro do usuÃ¡rio..."}
          rows={9}
          disabled={locked}
          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-700/60 dark:bg-[#071426] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-[#071426] dark:disabled:bg-[#0d1b2f] dark:disabled:text-slate-400"
          data-testid="access-request-internal-notes"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={`text-xs font-bold ${remaining <= 100 ? "text-amber-700 dark:text-amber-300" : "text-slate-400 dark:text-slate-500"}`}>
              {limitedValue.length}/{INTERNAL_NOTES_LIMIT}
            </span>
<<<<<<< HEAD
            <p className="mt-1 text-xs font-semibold text-slate-500">
              VisÃ­vel somente para revisores/admins.
=======
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Visível somente para revisores/admins.
>>>>>>> fix/governanca-perfis-rotas
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSave(limitedValue)}
            disabled={locked || saving}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-700 dark:hover:bg-sky-600"
          >
            {saving ? "Salvando..." : "Salvar nota interna"}
          </button>
        </div>
      </div>
    </section>
  );
}

