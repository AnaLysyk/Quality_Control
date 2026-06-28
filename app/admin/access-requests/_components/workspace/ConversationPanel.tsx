import type { AccessRequestCommentView } from "../../_types/accessRequests.types";
import { safeDate } from "./workspace.helpers";

export function ConversationPanel({
  comments,
  loading,
  error,
  locked,
  value,
  sending,
  onChange,
  onSend,
}: {
  comments: AccessRequestCommentView[];
  loading: boolean;
  error: string | null;
  locked: boolean;
  value: string;
  sending: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Chat da solicitacao</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Conversa com o solicitante</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Use para perguntas ou contexto adicional. Se clicar em Solicitar ajuste, este texto entra como mensagem geral da devolucao.
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
              Nenhuma interacao registrada.
            </p>
          ) : (
            comments.map((comment) => {
              const mine = comment.authorRole === "leader_tc";
              return (
                <div key={comment.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-xl border px-4 py-3 ${mine ? "border-slate-300 bg-white" : "border-slate-200 bg-white"}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      {mine ? "Revisor" : "Solicitante"} - {comment.authorName}
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
            Solicitacao finalizada. Conversa bloqueada.
          </div>
        ) : (
          <div className="mt-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Nova mensagem
              </span>
              <textarea
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                rows={4}
                placeholder="Ex.: Ana, preciso confirmar um detalhe antes de concluir sua solicitacao."
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">
                Enviar mensagem nao muda o status. Solicitar ajuste muda o status e envia campos marcados.
              </p>
              <button
                type="button"
                onClick={onSend}
                disabled={sending || value.trim().length === 0}
                className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Enviando..." : "Enviar mensagem"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
