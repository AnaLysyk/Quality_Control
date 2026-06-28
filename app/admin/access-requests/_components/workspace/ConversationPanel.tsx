import type { AccessRequestCommentView } from "../../_types/accessRequests.types";
import { safeDate } from "./workspace.helpers";

export function ConversationPanel({
  comments,
  loading,
  error,
  locked,
  value,
  selectedFieldCount,
  onChange,
}: {
  comments: AccessRequestCommentView[];
  loading: boolean;
  error: string | null;
  locked: boolean;
  value: string;
  selectedFieldCount: number;
  onChange: (value: string) => void;
}) {
  const messageRequired = selectedFieldCount > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Chat da solicitação</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Conversa que o solicitante recebe</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Este chat acompanha a devolução. Campos marcados e observações por campo serão enviados junto da mensagem.
          </p>
        </div>
        {loading ? <span className="text-sm font-medium text-slate-500">Carregando...</span> : null}
      </div>

      <div className="p-5">
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>
        ) : null}

        <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {comments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
              Nenhuma interação registrada.
            </p>
          ) : (
            comments.map((comment) => {
              const mine = comment.authorRole === "leader_tc";
              return (
                <div key={comment.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-xl border px-4 py-3 ${mine ? "border-slate-300 bg-white" : "border-slate-200 bg-white"}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      {mine ? "Revisor" : "Solicitante"} · {comment.authorName}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{comment.body}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">{safeDate(comment.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {locked ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
            Solicitação finalizada. Conversa bloqueada.
          </div>
        ) : (
          <label className="mt-4 block">
            <span className={`text-xs font-black uppercase tracking-[0.14em] ${messageRequired ? "text-red-700" : "text-slate-500"}`}>
              {messageRequired ? "Mensagem obrigatória para solicitar ajuste" : "Nova mensagem"}
            </span>
            {messageRequired ? (
              <p className="mt-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                {selectedFieldCount} campo(s) marcado(s). Escreva aqui a orientação geral que o usuário receberá.
              </p>
            ) : null}
            <textarea
              className={`mt-2 w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 ${messageRequired ? "border-red-200 focus:border-red-400" : "border-slate-200 focus:border-slate-400"}`}
              rows={4}
              placeholder="Ex.: Ana, marquei os campos que precisam de ajuste. Informe a empresa correta e revise o perfil solicitado."
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
        )}
      </div>
    </section>
  );
}
