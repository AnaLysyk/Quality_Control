import type { AccessRequestCommentView } from "../../_types/accessRequests.types";
import { safeDate } from "./workspace.helpers";

export function ConversationPanel({
  comments,
  loading,
  error,
  locked,
  value,
  onChange,
}: {
  comments: AccessRequestCommentView[];
  loading: boolean;
  error: string | null;
  locked: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Conversa com o solicitante</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Mensagem para ajuste ou decisão</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use este campo para orientar o solicitante. A mensagem acompanha solicitar ajuste ou recusar.</p>
        </div>
        {loading ? <span className="text-sm font-medium text-slate-500">Carregando...</span> : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>
      ) : null}

      <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Nenhuma interação registrada ainda. Escreva abaixo se precisar devolver para ajuste.</p>
          ) : (
            comments.map((comment) => {
              const mine = comment.authorRole === "leader_tc";
              return (
                <div key={comment.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-[20px] border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${mine ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-200 bg-white text-slate-950"}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {mine ? "Admin" : "Solicitante"} · {comment.authorName}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">{safeDate(comment.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {locked ? (
          <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
            Solicitação finalizada — conversa bloqueada.
          </div>
        ) : (
          <textarea
            className="mt-4 w-full resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--tc-accent)] focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
            rows={3}
            placeholder="Escreva o que o solicitante precisa corrigir ou o motivo da decisão..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    </section>
  );
}
